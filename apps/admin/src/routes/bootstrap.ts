import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import type { AppDeps } from "../app.ts";
import { auditStatement, nowIso } from "../db.ts";
import type { AppEnv } from "../types.ts";

/** Constant-time comparison, so the token cannot be guessed one character at a time. */
async function sameSecret(a: string, b: string) {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  return crypto.subtle.timingSafeEqual(ha, hb);
}

/**
 * Creates the first administrator. It works only while BOOTSTRAP_TOKEN is set
 * and no administrator exists. Afterwards it refuses every request.
 *
 *   xh POST https://<admin host>/api/bootstrap authorization:"Bearer $TOKEN" email=you@gmail.com name="Your Name"
 */
export function bootstrapRoutes(deps: AppDeps) {
  const app = new Hono<AppEnv>();
  app.post("/", async (c) => {
    const token = (c.env as { BOOTSTRAP_TOKEN?: string }).BOOTSTRAP_TOKEN;
    const given =
      c.req.header("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    if (!token || token.length < 32 || !(await sameSecret(given, token)))
      throw new HTTPException(404, { message: "Not found." });
    const admins = await c.env.DB.prepare(
      "select count(*) as n from user_roles where role = 'admin'",
    ).first<{ n: number }>();
    if ((admins?.n ?? 0) > 0)
      throw new HTTPException(409, {
        message:
          "An administrator already exists. Invite people from the People page.",
      });
    const input = z
      .object({
        email: z.email().transform((e) => e.toLowerCase()),
        name: z.string().trim().min(1).max(120),
      })
      .parse(await c.req.json());
    const ctx = await deps.getAuth(c.env).$context;
    const existing = await ctx.internalAdapter.findUserByEmail(input.email);
    const user =
      existing?.user ??
      (await ctx.internalAdapter.createUser(
        { email: input.email, name: input.name, emailVerified: true },
        { method: "admin" },
      ));
    await c.env.DB.batch([
      c.env.DB.prepare(
        "insert into user_roles (user_id, role, scope, granted_at) values (?, 'admin', '', ?) on conflict do nothing",
      ).bind(user.id, nowIso()),
      auditStatement(c.env.DB, user.id, "bootstrap_admin", "user", user.id, {
        email: input.email,
      }),
    ]);
    return c.json({ id: user.id, email: input.email }, 201);
  });
  return app;
}
