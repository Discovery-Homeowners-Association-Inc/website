import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import { ZodError } from "zod";
import { requireUser } from "./access.ts";
import type { Auth } from "./auth.ts";
import { bootstrapRoutes } from "./routes/bootstrap.ts";
import { fileRoutes, serveFile } from "./routes/files.ts";
import { itemRoutes } from "./routes/items.ts";
import { meetingRoutes } from "./routes/meetings.ts";
import { minutesRoutes } from "./routes/minutes.ts";
import { profileRoutes } from "./routes/profile.ts";
import {
  edgeCache,
  invalidateSnapshot,
  publicRoutes,
  type SnapshotCache,
} from "./routes/public.ts";
import { rosterRoutes } from "./routes/roster.ts";
import { settingsRoutes } from "./routes/settings.ts";
import { auditRoutes } from "./routes/audit.ts";
import { userRoutes } from "./routes/users.ts";
import type { AppEnv, ResolveUser } from "./types.ts";

export type AppDeps = {
  resolveUser: ResolveUser;
  currentSessionId: (request: Request, env: Env) => Promise<string | null>;
  getAuth: (env: Env) => Auth;
  /** Called after anything the public site shows has changed. */
  siteChanged: (env: Env, reason: string) => Promise<void>;
  /** Where the public snapshot is cached. Defaults to the edge cache. */
  snapshotCache?: SnapshotCache;
};

export function createApp(deps: AppDeps) {
  /*
   * The cached public snapshot is dropped on every content change, before the
   * site rebuild is asked for. The site build fetches the snapshot moments
   * later, so a stale entry here would rebuild the site from its previous
   * state. Wrapping the dependency rather than the entry point keeps this on
   * the path the tests exercise.
   */
  const cache = deps.snapshotCache ?? edgeCache;
  // Captured before deps is replaced below: reading deps.siteChanged at call
  // time would find this wrapper and call itself for ever.
  const notify = deps.siteChanged;
  const siteChanged: AppDeps["siteChanged"] = async (env, reason) => {
    await invalidateSnapshot(env, cache);
    await notify(env, reason);
  };
  deps = { ...deps, siteChanged };

  const app = new Hono<AppEnv>();
  app.use("*", secureHeaders());

  app.on(["GET", "POST"], "/api/auth/*", (c) =>
    deps.getAuth(c.env).handler(c.req.raw),
  );
  app.route("/api/bootstrap", bootstrapRoutes(deps));
  app.route("/api/public", publicRoutes(cache));

  const api = new Hono<AppEnv>();
  api.use("*", requireUser(deps.resolveUser));
  api.route("/me", profileRoutes(deps));
  api.route("/users", userRoutes(deps));
  api.route("/meetings", meetingRoutes(deps));
  api.route("/meetings", minutesRoutes());
  api.route("/items", itemRoutes(deps));
  api.route("/settings", settingsRoutes(deps));
  api.route("/roster", rosterRoutes(deps));
  api.route("/files", fileRoutes());
  api.route("/audit", auditRoutes());
  api.get("/files/:id/content", (c) => serveFile(c.env, c.req.param("id")));
  app.route("/api", api);

  app.onError((err, c) => {
    if (err instanceof HTTPException)
      return c.json({ error: err.message }, err.status);
    if (err instanceof ZodError) {
      const first = err.issues[0];
      const where = first?.path.length ? ` (${first.path.join(" › ")})` : "";
      return c.json(
        {
          error: `Some fields are missing or invalid${where}: ${first?.message ?? ""}`,
          issues: err.issues,
        },
        400,
      );
    }
    console.error(err);
    return c.json({ error: "Something went wrong on the server." }, 500);
  });
  app.notFound((c) => c.json({ error: "Not found." }, 404));
  return app;
}
