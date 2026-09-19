import { Hono } from "hono";
import { z } from "zod";
import { auditStatement, nowIso } from "../db.ts";
import type { AppEnv } from "../types.ts";
import type { AppDeps } from "../app.ts";

/** Your own account: your name, and where you are signed in. */
export function profileRoutes(deps: AppDeps) {
  const app = new Hono<AppEnv>();

  app.get("/", async (c) => {
    const user = c.get("user");
    const sessions = await c.env.DB.prepare(
      'select id, "createdAt" as created_at, "userAgent" as user_agent, "ipAddress" as ip from "session" where "userId" = ? and "expiresAt" > ? order by "createdAt" desc',
    )
      .bind(user.id, nowIso())
      .all();
    const account = await c.env.DB.prepare(
      'select "providerId" as provider from account where "userId" = ?',
    )
      .bind(user.id)
      .first<{ provider: string }>();
    return c.json({
      ...user,
      provider: account?.provider ?? null,
      sessions: sessions.results,
    });
  });

  app.patch("/", async (c) => {
    const { name } = z
      .object({ name: z.string().trim().min(1).max(120) })
      .parse(await c.req.json());
    const user = c.get("user");
    await c.env.DB.batch([
      c.env.DB.prepare(
        'update "user" set name = ?, "updatedAt" = ? where id = ?',
      ).bind(name, nowIso(), user.id),
      auditStatement(c.env.DB, user.id, "rename", "user", user.id, { name }),
    ]);
    return c.json({ ...user, name });
  });

  /** Sign out everywhere else: ends every session except the one making this request. */
  app.post("/sign-out-others", async (c) => {
    const user = c.get("user");
    const current = await deps.currentSessionId(c.req.raw, c.env);
    await c.env.DB.batch([
      c.env.DB.prepare(
        'delete from "session" where "userId" = ? and id != ?',
      ).bind(user.id, current ?? ""),
      auditStatement(c.env.DB, user.id, "sign_out_others", "user", user.id),
    ]);
    return c.body(null, 204);
  });

  return app;
}
