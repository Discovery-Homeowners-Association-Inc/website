import { ROLES } from "@dhoa/shared";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { requireRole } from "../access.ts";
import { auditStatement, grantsFor, nowIso } from "../db.ts";
import type { AppEnv } from "../types.ts";
import type { AppDeps } from "../app.ts";

const Grants = z
  .array(
    z.object({
      role: z.enum(ROLES),
      scope: z
        .string()
        .trim()
        .max(40)
        .regex(/^[a-z-]*$/)
        .default(""),
    }),
  )
  .min(1)
  .max(10);

const Invite = z.object({
  email: z.email().transform((e) => e.toLowerCase()),
  name: z.string().trim().min(1).max(120),
  grants: Grants,
});

export function userRoutes(deps: AppDeps) {
  const app = new Hono<AppEnv>();
  app.use("*", requireRole("admin"));

  app.get("/", async (c) => {
    const { results } = await c.env.DB.prepare(
      `select u.id, u.name, u.email, coalesce(json_group_array(json_object('role', r.role, 'scope', r.scope)) filter (where r.role is not null), '[]') as grants,
              exists (select 1 from account a where a.userId = u.id) as signed_in,
              f.removed_at
         from "user" u left join user_roles r on r.user_id = u.id left join former_members f on f.user_id = u.id
        group by u.id order by u.name`,
    ).all<{
      id: string;
      name: string;
      email: string;
      grants: string;
      signed_in: number;
      removed_at: string | null;
    }>();
    return c.json(
      results.map((u) => ({
        ...u,
        grants: JSON.parse(u.grants),
        signed_in: u.signed_in === 1,
        former: u.removed_at !== null,
      })),
    );
  });

  /** Invite someone: creates their account so their first Google sign-in with this address is accepted. */
  app.post("/", async (c) => {
    const input = Invite.parse(await c.req.json());
    const ctx = await deps.getAuth(c.env).$context;
    const existing = await ctx.internalAdapter.findUserByEmail(input.email);
    if (existing) {
      const former = await c.env.DB.prepare(
        "select 1 from former_members where user_id = ?",
      )
        .bind(existing.user.id)
        .first();
      throw new HTTPException(409, {
        message: former
          ? `${input.email} is a former member. Restore their access from the list of former members.`
          : `${input.email} already has an account.`,
      });
    }
    const user = await ctx.internalAdapter.createUser(
      { email: input.email, name: input.name, emailVerified: true },
      { method: "admin" },
    );
    const actor = c.get("user").id;
    await c.env.DB.batch([
      ...input.grants.map((g) =>
        c.env.DB.prepare(
          "insert into user_roles (user_id, role, scope, granted_by, granted_at) values (?, ?, ?, ?, ?)",
        ).bind(user.id, g.role, g.scope, actor, nowIso()),
      ),
      auditStatement(c.env.DB, actor, "invite", "user", user.id, {
        email: input.email,
        grants: input.grants,
      }),
    ]);
    return c.json(
      {
        id: user.id,
        email: input.email,
        name: input.name,
        grants: input.grants,
      },
      201,
    );
  });

  app.put("/:id/grants", async (c) => {
    const id = c.req.param("id");
    const grants = Grants.parse((await c.req.json()).grants);
    const actor = c.get("user").id;
    if (
      id === actor &&
      !grants.some((g) => g.role === "admin" && g.scope === "")
    ) {
      throw new HTTPException(422, {
        message: "You cannot remove your own administrator role.",
      });
    }
    await c.env.DB.batch([
      c.env.DB.prepare("delete from former_members where user_id = ?").bind(id),
      c.env.DB.prepare("delete from user_roles where user_id = ?").bind(id),
      ...grants.map((g) =>
        c.env.DB.prepare(
          "insert into user_roles (user_id, role, scope, granted_by, granted_at) values (?, ?, ?, ?, ?)",
        ).bind(id, g.role, g.scope, actor, nowIso()),
      ),
      auditStatement(c.env.DB, actor, "set_grants", "user", id, { grants }),
    ]);
    return c.json({ id, grants: await grantsFor(c.env.DB, id) });
  });

  /**
   * Remove someone's access. Their account is kept so their name stays on
   * everything they did; their roles are revoked and every session ends now.
   */
  app.delete("/:id", async (c) => {
    const id = c.req.param("id");
    const actor = c.get("user").id;
    if (id === actor)
      throw new HTTPException(422, {
        message: "You cannot remove your own access.",
      });
    const note = z
      .object({ note: z.string().trim().max(500).default("") })
      .parse(await c.req.json().catch(() => ({})));
    const user = await c.env.DB.prepare('select id from "user" where id = ?')
      .bind(id)
      .first();
    if (!user)
      throw new HTTPException(404, { message: "That person does not exist." });
    await c.env.DB.batch([
      c.env.DB.prepare("delete from user_roles where user_id = ?").bind(id),
      c.env.DB.prepare('delete from "session" where "userId" = ?').bind(id),
      c.env.DB.prepare(
        "insert into former_members (user_id, removed_at, removed_by, note) values (?, ?, ?, ?) on conflict (user_id) do nothing",
      ).bind(id, nowIso(), actor, note.note),
      auditStatement(c.env.DB, actor, "remove_access", "user", id, note),
    ]);
    return c.body(null, 204);
  });

  return app;
}
