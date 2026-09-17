import { describe, expect, it } from "vitest";
import { call, makeUser } from "./helpers.ts";

describe("access", () => {
  it("rejects anonymous requests", async () => {
    expect((await call(null, "GET", "/api/me")).status).toBe(401);
  });

  it("rejects a signed-in person with no role", async () => {
    const nobody = await makeUser([]);
    expect((await call(nobody, "GET", "/api/me")).status).toBe(403);
  });

  it("lets only admins invite people", async () => {
    const admin = await makeUser(["admin"]);
    const secretary = await makeUser(["secretary"]);
    const invite = {
      email: "New.Director@Example.com",
      name: "New Director",
      grants: [{ role: "board" }],
    };
    expect((await call(secretary, "POST", "/api/users", invite)).status).toBe(
      403,
    );
    const created = await call(admin, "POST", "/api/users", invite);
    expect(created.status).toBe(201);
    expect(created.json.email).toBe("new.director@example.com");
    expect((await call(admin, "POST", "/api/users", invite)).status).toBe(409);
    expect((await call(created.json.id, "GET", "/api/me")).json.grants).toEqual(
      [{ role: "board", scope: "" }],
    );
  });

  it("stops an admin from removing their own admin role or account", async () => {
    const admin = await makeUser(["admin"]);
    expect(
      (
        await call(admin, "PUT", `/api/users/${admin}/grants`, {
          grants: [{ role: "board" }],
        })
      ).status,
    ).toBe(422);
    expect((await call(admin, "DELETE", `/api/users/${admin}`)).status).toBe(
      422,
    );
  });

  it("never shows minutes to an editor", async () => {
    const secretary = await makeUser(["secretary"]);
    const editor = await makeUser(["editor"]);
    await call(secretary, "POST", "/api/meetings", {
      type: "board",
      date: "2026-10-20",
      time: "7:00 pm",
      location: "Recreation Center",
    });
    expect(
      (await call(editor, "GET", "/api/meetings/2026-10-20-board/minutes"))
        .status,
    ).toBe(403);
  });
});
