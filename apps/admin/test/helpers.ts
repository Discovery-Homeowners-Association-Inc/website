import type { Role } from "@dhoa/shared";
import { env } from "cloudflare:workers";
import { createApp } from "../src/app.ts";
import { createAuth } from "../src/auth.ts";

/**
 * The app under test, with sign-in replaced by an `x-test-user` header naming
 * a user id. Everything after sign-in (roles, D1, KV, the rules) is real.
 */
const auth = createAuth(env);
export const rebuilds: string[] = [];

/**
 * An in-memory stand-in for the edge cache. The real one cannot be used here:
 * a stored `Response` holds an unread stream, and cloning those across tests
 * crashes the worker. Same contract, so the caching logic is still
 * exercised.
 */
const store = new Map<string, string>();
export const snapshotCache = {
  // The body is kept as text, not as a Response, for the same reason.
  match: async (key: Request) => {
    const body = store.get(key.url);
    return body === undefined
      ? undefined
      : new Response(body, {
          status: 200,
          headers: { "content-type": "application/json; charset=UTF-8" },
        });
  },
  put: async (key: Request, res: Response) =>
    void store.set(key.url, await res.text()),
};

export const app = createApp({
  snapshotCache,
  getAuth: () => auth,
  siteChanged: async (_env, reason) => void rebuilds.push(reason),
  currentSessionId: async (request) => request.headers.get("x-test-session"),
  resolveUser: async (request) => {
    const id = request.headers.get("x-test-user");
    if (!id) return null;
    return env.DB.prepare('select id, email, name from "user" where id = ?')
      .bind(id)
      .first<{ id: string; email: string; name: string }>();
  },
});

let counter = 0;
export async function makeUser(roles: Role[], name = `Person ${++counter}`) {
  const ctx = await auth.$context;
  const user = await ctx.internalAdapter.createUser(
    {
      email: `person${counter}-${crypto.randomUUID()}@example.com`,
      name,
      emailVerified: true,
    },
    { method: "admin" },
  );
  for (const role of roles) {
    await env.DB.prepare(
      "insert into user_roles (user_id, role, scope, granted_at) values (?, ?, '', ?)",
    )
      .bind(user.id, role, new Date().toISOString())
      .run();
  }
  return user.id;
}

export async function call(
  userId: string | null,
  method: string,
  path: string,
  body?: unknown,
  extra: Record<string, string> = {},
) {
  const headers = new Headers({ "content-type": "application/json", ...extra });
  if (userId) headers.set("x-test-user", userId);
  const res = await app.request(
    path,
    {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    env,
  );
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

/** Loads the seed settings, so routes that need them (approvals, snapshot) work. */
export async function seedSettings() {
  const { SETTINGS } = await import("@dhoa/shared");
  const seed = (await import("../seed/settings.json")).default as Record<
    string,
    unknown
  >;
  for (const [key, schema] of Object.entries(SETTINGS)) {
    await env.DB.prepare(
      "insert or replace into settings (key, value, updated_at) values (?, ?, ?)",
    )
      .bind(
        key,
        JSON.stringify(schema.parse(seed[key])),
        new Date().toISOString(),
      )
      .run();
  }
}
