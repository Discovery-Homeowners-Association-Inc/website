import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { app, call } from "./helpers.ts";

const TOKEN = "t".repeat(40);
const post = (
  token: string | null,
  body: unknown,
  e: object = { ...env, BOOTSTRAP_TOKEN: TOKEN },
) =>
  app.request(
    "/api/bootstrap",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    },
    e,
  );

describe("bootstrap", () => {
  it("does not exist without a token configured", async () => {
    expect(
      (await post(TOKEN, { email: "a@example.com", name: "A" }, env)).status,
    ).toBe(404);
  });

  it("rejects a wrong token", async () => {
    expect(
      (await post("wrong", { email: "a@example.com", name: "A" })).status,
    ).toBe(404);
  });

  it("creates the first admin once, then refuses", async () => {
    await env.DB.prepare("delete from user_roles where role = 'admin'").run();
    const first = await post(TOKEN, {
      email: "First.Admin@example.com",
      name: "First Admin",
    });
    expect(first.status).toBe(201);
    const { id } = (await first.json()) as { id: string };
    expect((await call(id, "GET", "/api/me")).json.grants).toEqual([
      { role: "admin", scope: "" },
    ]);
    expect(
      (await post(TOKEN, { email: "second@example.com", name: "Second" }))
        .status,
    ).toBe(409);
  });
});
