import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import { ZodError } from "zod";
import { requireUser } from "./access.ts";
import type { Auth } from "./auth.ts";
import { bootstrapRoutes } from "./routes/bootstrap.ts";
import { meetingRoutes } from "./routes/meetings.ts";
import { minutesRoutes } from "./routes/minutes.ts";
import { userRoutes } from "./routes/users.ts";
import type { AppEnv, ResolveUser } from "./types.ts";

export type AppDeps = { resolveUser: ResolveUser; getAuth: (env: Env) => Auth };

export function createApp(deps: AppDeps) {
  const app = new Hono<AppEnv>();
  app.use("*", secureHeaders());

  app.on(["GET", "POST"], "/api/auth/*", (c) =>
    deps.getAuth(c.env).handler(c.req.raw),
  );

  app.route("/api/bootstrap", bootstrapRoutes(deps));

  const api = new Hono<AppEnv>();
  api.use("*", requireUser(deps.resolveUser));
  api.get("/me", (c) => c.json(c.get("user")));
  api.route("/users", userRoutes(deps));
  api.route("/meetings", meetingRoutes());
  api.route("/meetings", minutesRoutes());
  app.route("/api", api);

  app.onError((err, c) => {
    if (err instanceof HTTPException)
      return c.json({ error: err.message }, err.status);
    if (err instanceof ZodError)
      return c.json(
        { error: "Some fields are missing or invalid.", issues: err.issues },
        400,
      );
    console.error(err);
    return c.json({ error: "Something went wrong on the server." }, 500);
  });
  app.notFound((c) => c.json({ error: "Not found." }, 404));
  return app;
}
