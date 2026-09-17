import { Hono } from "hono";
import { serveFile } from "./files.ts";
import { buildSnapshot } from "../snapshot.ts";

/** No sign-in. Only what the public site is allowed to show. */
export function publicRoutes() {
  const app = new Hono<{ Bindings: Env }>();
  app.get("/site.json", async (c) => {
    const origin = new URL(c.req.url).origin;
    const snapshot = await buildSnapshot(
      c.env.DB,
      new Date(),
      (id) => `${origin}/api/public/files/${id}`,
    );
    return c.json(snapshot, 200, { "cache-control": "public, max-age=300" });
  });
  app.get("/files/:id", (c) => serveFile(c.env, c.req.param("id")));
  return app;
}
