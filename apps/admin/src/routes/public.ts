import { Hono } from "hono";
import { servePublicFile } from "./files.ts";
import { buildSnapshot } from "../snapshot.ts";

/**
 * Where the built snapshot is kept. Production uses the edge cache, which is
 * shared by every isolate in a colo; the tests pass an in-memory stand-in,
 * because `caches.default.delete()` never settles when it is called from inside
 * a request handler under the Workers test harness.
 */
export type SnapshotCache = {
  match(key: Request): Promise<Response | undefined>;
  put(key: Request, res: Response): Promise<void>;
  delete(key: Request): Promise<void>;
};

export const edgeCache: SnapshotCache = {
  match: (key) => caches.default.match(key),
  put: (key, res) => caches.default.put(key, res),
  delete: async (key) => void (await caches.default.delete(key)),
};

/**
 * The key is derived from BETTER_AUTH_URL rather than from the request, so one
 * entry is cached and cleared however the Worker was reached. The file URLs in
 * the body use the same origin, which keeps the cached body correct for every
 * caller instead of carrying whichever host happened to build it.
 */
const snapshotKey = (env: Env) =>
  new Request(new URL("/api/public/site.json", env.BETTER_AUTH_URL).toString());

/** Drop the cached snapshot. Called for every change to published content. */
export async function invalidateSnapshot(
  env: Env,
  cache: SnapshotCache = edgeCache,
): Promise<void> {
  await cache.delete(snapshotKey(env));
}

/** No sign-in. Only what the public site is allowed to show. */
export function publicRoutes(cache: SnapshotCache = edgeCache) {
  const app = new Hono<{ Bindings: Env }>();
  app.get("/site.json", async (c) => {
    const key = snapshotKey(c.env);
    const hit = await cache.match(key);
    // Copied, not returned as-is: a response out of the cache has immutable
    // headers, and the secureHeaders middleware adds to them on the way out.
    // Returning the cache's own object makes every cache hit a 500.
    if (hit) return new Response(hit.body, hit);

    /*
     * The snapshot is expensive: five queries and the serialisation of every
     * published item, measured at 22 to 35 ms of CPU on the deployed Worker
     * against a 10 ms Workers Free limit. Every content change clears it, so
     * the site build never sees a stale one.
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
