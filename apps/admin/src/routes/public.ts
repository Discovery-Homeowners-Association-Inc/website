import { Hono } from "hono";
import { servePublicFile } from "./files.ts";
import { buildSnapshot } from "../snapshot.ts";

/**
 * Where the built snapshot is kept. Production uses the edge cache, which is
 * shared by every isolate in a colo; the tests pass an in-memory stand-in,
 * because a stored `Response` holds an unread stream that cannot be cloned
 * across tests.
 */
export type SnapshotCache = {
  match(key: Request): Promise<Response | undefined>;
  put(key: Request, res: Response): Promise<void>;
};

export const edgeCache: SnapshotCache = {
  match: (key) => caches.default.match(key),
  put: (key, res) => caches.default.put(key, res),
};

export async function siteVersion(db: D1Database): Promise<number> {
  const row = await db
    .prepare("select version from site_version where id = 1")
    .first<{ version: number }>();
  return row?.version ?? 0;
}

/**
 * The key is derived from BETTER_AUTH_URL rather than from the request, so one
 * entry serves every caller, and it carries the site version, so no entry
 * outlives the content it was built from. One cheap read per request is the
 * whole cost; the entry is per data center, which is why clearing it was never
 * enough.
 */
const snapshotKey = (env: Env, version: number) => {
  const url = new URL("/api/public/site.json", env.BETTER_AUTH_URL);
  url.searchParams.set("v", String(version));
  return new Request(url.toString());
};

/** No sign-in. Only what the public site is allowed to show. */
export function publicRoutes(cache: SnapshotCache = edgeCache) {
  const app = new Hono<{ Bindings: Env }>();
  app.get("/site.json", async (c) => {
    const key = snapshotKey(c.env, await siteVersion(c.env.DB));
    const hit = await cache.match(key);
    // Copied, not returned as-is: a response out of the cache has immutable
    // headers, and the secureHeaders middleware adds to them on the way out.
    // Returning the cache's own object makes every cache hit a 500.
    if (hit) return new Response(hit.body, hit);

    /*
     * The snapshot is expensive: five queries and the serialization of every
     * published item, measured at 22 to 35 ms of CPU on the deployed Worker
     * against a 10 ms Workers Free limit. The cache key carries the site
     * version, so a stale entry is never served.
     */
    const origin = new URL(c.env.BETTER_AUTH_URL).origin;
    const snapshot = await buildSnapshot(
      c.env.DB,
      new Date(),
      (id) => `${origin}/api/public/files/${id}`,
    );
    // Built by hand rather than with c.json(): the cache needs a response whose
    // headers it can still work on, and this keeps what is stored and what is
    // returned identical by construction.
    const res = new Response(JSON.stringify(snapshot), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=UTF-8",
        "cache-control": "public, max-age=300",
      },
    });
    // Awaited rather than deferred with waitUntil: the write is a local cache
    // put on a response already in memory, and only happens on a miss.
    await cache.put(key, res.clone());
    return res;
  });
  app.get("/files/:id", (c) => servePublicFile(c.env, c.req.param("id")));
  return app;
}
