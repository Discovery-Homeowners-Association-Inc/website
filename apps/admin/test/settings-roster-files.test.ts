import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import { app, call, makeUser, seedSettings } from "./helpers.ts";

let admin: string, secretary: string, editor: string;
beforeAll(async () => {
  await seedSettings();
  admin = await makeUser(["admin"]);
  secretary = await makeUser(["secretary"]);
  editor = await makeUser(["editor"]);
});

describe("settings", () => {
  it("are readable by everyone signed in and writable by admins only", async () => {
    const all = await call(editor, "GET", "/api/settings");
    expect(all.json.organization.office.phone).toBe("301-845-2050");
    const parks = {
      count: 21,
      inspection_note: "Every summer.",
      report_note: "Tell the office.",
    };
    expect(
      (await call(secretary, "PUT", "/api/settings/parks", parks)).status,
    ).toBe(403);
    expect(
      (await call(admin, "PUT", "/api/settings/parks", parks)).json.count,
    ).toBe(21);
    expect(
      (await call(admin, "PUT", "/api/settings/parks", { count: "twenty" }))
        .status,
    ).toBe(400);
    expect((await call(admin, "PUT", "/api/settings/nope", {})).status).toBe(
      404,
    );
  });
});

describe("roster", () => {
  it("keeps people for history: ending a term is the only way to remove someone", async () => {
    const p = await call(secretary, "POST", "/api/roster/people", {
      name: "Jordan Jones",
      office: "Director",
      term_start: "2025-01-01",
    });
    expect(p.status).toBe(201);
    expect(
      (await call(admin, "DELETE", `/api/roster/people/${p.json.id}`)).status,
    ).toBe(409);
    const ended = await call(
      secretary,
      "PUT",
      `/api/roster/people/${p.json.id}`,
      { ...p.json, term_end: "2026-01-31" },
    );
    expect(ended.json.term_end).toBe("2026-01-31");
    expect(
      (await call(editor, "PUT", `/api/roster/people/${p.json.id}`, p.json))
        .status,
    ).toBe(403);
    const site = await call(null, "GET", "/api/public/site.json");
    expect(
      site.json.people.find((x: { name: string }) => x.name === "Jordan Jones")
        .term_end,
    ).toBe("2026-01-31");
  });
});

describe("files", () => {
  const upload = async (
    userId: string,
    name: string,
    type: string,
    bytes: Uint8Array,
  ) => {
    const form = new FormData();
    form.append("file", new File([bytes], name, { type }));
    const res = await app.request(
      "/api/files",
      { method: "POST", headers: { "x-test-user": userId }, body: form },
      env,
    );
    return {
      status: res.status,
      json: (await res.json()) as { id: string; name: string; size: number },
    };
  };

  it("stores an upload in KV and serves it publicly, and refuses other types", async () => {
    const pdf = new TextEncoder().encode("%PDF-1.4 test");
    const up = await upload(
      editor,
      "Rental form (2026).pdf",
      "application/pdf",
      pdf,
    );
    expect(up.status).toBe(201);
    expect(up.json.size).toBe(pdf.length);
    expect(await env.FILES.get(up.json.id, "text")).toBe("%PDF-1.4 test");
    const again = await upload(editor, "same.pdf", "application/pdf", pdf);
    expect(again.status).toBe(200);
    expect(again.json.id).toBe(up.json.id);

    const served = await app.request(
      `/api/public/files/${up.json.id}`,
      {},
      env,
    );
    expect(served.status).toBe(200);
    expect(served.headers.get("content-type")).toBe("application/pdf");
    expect(await served.text()).toBe("%PDF-1.4 test");

    expect((await upload(editor, "evil.html", "text/html", pdf)).status).toBe(
      415,
    );
  });

  it("will not delete a file that a document uses", async () => {
    const up = await upload(
      secretary,
      "policy.pdf",
      "application/pdf",
      new TextEncoder().encode("%PDF-1.4 policy"),
    );
    const doc = await call(secretary, "POST", "/api/items", {
      kind: "document",
      body: {
        title: "RV policy",
        summary: "The policy.",
        category: "rv-lot",
        file_id: up.json.id,
        file_name: "policy.pdf",
      },
    });
    expect(
      (await call(secretary, "DELETE", `/api/files/${up.json.id}`)).status,
    ).toBe(409);
    await call(secretary, "DELETE", `/api/items/${doc.json.id}`);
    expect(
      (await call(secretary, "DELETE", `/api/files/${up.json.id}`)).status,
    ).toBe(204);
    expect(await env.FILES.get(up.json.id)).toBeNull();
  });
});

describe("profile", () => {
  it("lets people rename themselves and sign out elsewhere", async () => {
    const me = await makeUser(["board"], "Old Name");
    const mk = async (id: string) =>
      env.DB.prepare(
        'insert into "session" (id, "expiresAt", token, "createdAt", "updatedAt", "userId") values (?, ?, ?, ?, ?, ?)',
      )
        .bind(
          id,
          new Date(Date.now() + 86400000).toISOString(),
          crypto.randomUUID(),
          new Date().toISOString(),
          new Date().toISOString(),
          me,
        )
        .run();
    await mk("s-this");
    await mk("s-phone");
    expect(
      (await call(me, "PATCH", "/api/me", { name: "New Name" })).json.name,
    ).toBe("New Name");
    expect((await call(me, "GET", "/api/me")).json.sessions).toHaveLength(2);
    expect(
      (
        await call(me, "POST", "/api/me/sign-out-others", undefined, {
          "x-test-session": "s-this",
        })
      ).status,
    ).toBe(204);
    expect(
      (await call(me, "GET", "/api/me")).json.sessions.map(
        (s: { id: string }) => s.id,
      ),
    ).toEqual(["s-this"]);
  });
});
