import type { Role } from "@dhoa/shared";
import { env } from "cloudflare:workers";
import { createApp } from "../src/app.ts";
import { createAuth } from "../src/auth.ts";

/**
 * The app under test, with sign-in replaced by an `x-test-user` header naming
 * a user id. Everything after sign-in (roles, D1, the rules) is the real code.
 */
const auth = createAuth(env);
export const app = createApp({
  getAuth: () => auth,
  resolveUser: async (request) => {
    const id = request.headers.get("x-test-user");
    if (!id) return null;
    const u = await env.DB.prepare(
      'select id, email, name from "user" where id = ?',
    )
      .bind(id)
      .first<{ id: string; email: string; name: string }>();
    return u;
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
) {
  const headers = new Headers({ "content-type": "application/json" });
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
