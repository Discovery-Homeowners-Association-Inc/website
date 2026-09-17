import type { Role } from "@dhoa/shared";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { grantsFor } from "./db.ts";
import type { AppEnv, ResolveUser } from "./types.ts";

export const hasRole = (
  grants: AppEnv["Variables"]["user"]["grants"],
  ...roles: Role[]
) => grants.some((g) => roles.includes(g.role) && g.scope === "");

/** Rejects anonymous requests and people with no role at all. Every admin route sits behind this. */
export const requireUser = (resolve: ResolveUser) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const who = await resolve(c.req.raw, c.env);
    if (!who) throw new HTTPException(401, { message: "Sign in to continue." });
    const former = await c.env.DB.prepare(
      "select 1 from former_members where user_id = ?",
    )
      .bind(who.id)
      .first();
    if (former)
      throw new HTTPException(403, {
        message:
          "Your access has been removed. Ask an administrator if this is a mistake.",
      });
    const grants = await grantsFor(c.env.DB, who.id);
    if (grants.length === 0)
      throw new HTTPException(403, {
        message: "Your account has no access yet. Ask an administrator.",
      });
    c.set("user", { ...who, grants });
    await next();
  });

export const requireRole = (...roles: Role[]) =>
  createMiddleware<AppEnv>(async (c, next) => {
    if (!hasRole(c.get("user").grants, ...roles)) {
      throw new HTTPException(403, {
        message: "You do not have permission to do that.",
      });
    }
    await next();
  });
