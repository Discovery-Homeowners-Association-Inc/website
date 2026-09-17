import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { call, makeUser } from "./helpers.ts";

describe("former members", () => {
  it("keeps the person, ends their access, and keeps their name on what they did", async () => {
    const admin = await makeUser(["admin", "secretary"], "Avery Admin");
    const director = await makeUser(["board"], "Morgan Leaving");
    await env.DB.prepare(
      'insert into "session" (id, "expiresAt", token, "createdAt", "updatedAt", "userId") values (?, ?, ?, ?, ?, ?)',
    )
      .bind(
        crypto.randomUUID(),
        new Date(Date.now() + 86400000).toISOString(),
        crypto.randomUUID(),
        new Date().toISOString(),
        new Date().toISOString(),
        director,
      )
      .run();

    const meeting = (
      await call(admin, "POST", "/api/meetings", {
        type: "annual",
        date: "2026-11-02",
        time: "7:00 pm",
        location: "Recreation Center",
      })
    ).json.id;
    await call(admin, "PUT", `/api/meetings/${meeting}/minutes`, {
      base_version: 0,
      body: { items: [{ id: "a", title: "Elections" }] },
    });
    await call(admin, "POST", `/api/meetings/${meeting}/minutes/transition`, {
      to: "in_review",
    });
    expect(
      (
        await call(
          director,
          "POST",
          `/api/meetings/${meeting}/minutes/comments`,
          { body: "Spell the candidate's name out." },
        )
      ).status,
    ).toBe(201);
    await call(director, "POST", `/api/meetings/${meeting}/minutes/reviewed`);

    expect(
      (
        await call(admin, "DELETE", `/api/users/${director}`, {
          note: "Term ended",
        })
      ).status,
    ).toBe(204);

    // Access is gone and sessions are revoked.
    expect((await call(director, "GET", "/api/me")).status).toBe(403);
    const sessions = await env.DB.prepare(
      'select count(*) as n from "session" where "userId" = ?',
    )
      .bind(director)
      .first<{ n: number }>();
    expect(sessions?.n).toBe(0);

    // History still names them, marked as a former member.
    const minutes = (
      await call(admin, "GET", `/api/meetings/${meeting}/minutes`)
    ).json;
    expect(minutes.comments[0]).toMatchObject({
      author: "Morgan Leaving",
      author_former: 1,
    });
    expect(minutes.reviewed_by[0]).toMatchObject({
      name: "Morgan Leaving",
      former: 1,
    });
    const people = (await call(admin, "GET", "/api/users")).json as {
      id: string;
      former: boolean;
      name: string;
    }[];
    expect(people.find((p) => p.id === director)).toMatchObject({
      name: "Morgan Leaving",
      former: true,
    });

    // Inviting the same address points to restoring instead.
    const email =
      (
        await env.DB.prepare('select email from "user" where id = ?')
          .bind(director)
          .first<{ email: string }>()
      )?.email ?? "";
    const again = await call(admin, "POST", "/api/users", {
      email,
      name: "Morgan",
      grants: [{ role: "board" }],
    });
    expect(again.status).toBe(409);
    expect(again.json.error).toMatch(/former member/);

    // Restoring access by giving roles back.
    expect(
      (
        await call(admin, "PUT", `/api/users/${director}/grants`, {
          grants: [{ role: "board" }],
        })
      ).status,
    ).toBe(200);
    expect((await call(director, "GET", "/api/me")).status).toBe(200);
  });
});
