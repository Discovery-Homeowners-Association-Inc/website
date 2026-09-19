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

  it("answers for one group without every other group being valid", async () => {
    // A corrupt row elsewhere must not take the one being asked for down with it.
    await env.DB.prepare(
      "update settings set value = '{\"nonsense\": true}' where key = 'links'",
    ).run();
    const one = await call(editor, "GET", "/api/settings/parks");
    expect(one.status).toBe(200);
    expect(typeof one.json.count).toBe("number");
    await seedSettings();
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

  it("records nothing in the log for a person who does not exist", async () => {
    const r = await call(secretary, "PUT", "/api/roster/people/nobody", {
      name: "Ghost",
    });
    expect(r.status).toBe(404);
    expect(
      await env.DB.prepare(
        "select 1 from audit_log where entity = 'person' and entity_id = 'nobody'",
      ).first(),
    ).toBeNull();
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

  it("stores an upload in KV and refuses other types", async () => {
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

    // Uploaded is not published. Nothing points at this file yet, so the
    // public route must not hand it out.
    const early = await app.request(`/api/public/files/${up.json.id}`, {}, env);
    expect(early.status).toBe(404);

    expect((await upload(editor, "evil.html", "text/html", pdf)).status).toBe(
      415,
    );
  });

  it("serves a file publicly once a published document points at it, and stops when it stops", async () => {
    const bytes = new TextEncoder().encode("%PDF-1.4 bylaws");
    const up = await upload(secretary, "bylaws.pdf", "application/pdf", bytes);
    expect(up.status).toBe(201);
    const url = `/api/public/files/${up.json.id}`;

    expect((await app.request(url, {}, env)).status).toBe(404);

    const doc = await call(secretary, "POST", "/api/items", {
      kind: "document",
      body: {
        title: "Bylaws",
        summary: "The bylaws.",
        category: "governing",
        file_id: up.json.id,
      },
    });
    expect(doc.status).toBe(201);
    // Still a draft.
    expect((await app.request(url, {}, env)).status).toBe(404);

    // Documents need approval, and nobody approves their own submission.
    expect(
      (
        await call(secretary, "POST", `/api/items/${doc.json.id}/action`, {
          action: "submit",
        })
      ).status,
    ).toBe(200);
    expect((await app.request(url, {}, env)).status).toBe(404);
    expect(
      (
        await call(admin, "POST", `/api/items/${doc.json.id}/action`, {
          action: "approve",
        })
      ).status,
    ).toBe(200);
    const served = await app.request(url, {}, env);
    expect(served.status).toBe(200);
    expect(await served.text()).toBe("%PDF-1.4 bylaws");

    const site = await call(null, "GET", "/api/public/site.json");
    const listed = site.json.documents.find(
      (d: { slug: string }) => d.slug === "bylaws",
    );
    expect(listed.file_type).toBe("application/pdf");

    // Unpublishing takes the file back out of public reach with the document.
    expect(
      (
        await call(admin, "POST", `/api/items/${doc.json.id}/action`, {
          action: "unpublish",
        })
      ).status,
    ).toBe(200);
    expect((await app.request(url, {}, env)).status).toBe(404);
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

  it("keeps the signed-in preview private and away from editors' roles it does not need", async () => {
    const up = await upload(
      secretary,
      "private.pdf",
      "application/pdf",
      new TextEncoder().encode("%PDF-1.4 private"),
    );
    const res = await app.request(
      `/api/files/${up.json.id}/content`,
      { headers: { "x-test-user": secretary } },
      env,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, max-age=0");
    const director = await makeUser(["board"]);
    expect(
      (
        await app.request(
          `/api/files/${up.json.id}/content`,
          { headers: { "x-test-user": director } },
          env,
        )
      ).status,
    ).toBe(403);
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
    expect(
      await env.DB.prepare(
        "select 1 from audit_log where action = 'sign_out_others' and actor_id = ?",
      )
        .bind(me)
        .first(),
    ).not.toBeNull();
  });

  it("tells the admin app where the public site is", async () => {
    const me = await makeUser(["editor"]);
    const res = await call(me, "GET", "/api/me");
    expect(res.json.site_url).toMatch(/^https:\/\//);
  });
});

describe("what the roster hands out", () => {
  it("keeps phone numbers and unpublished emails to the people who edit the roster", async () => {
    const person = {
      name: "Quiet Director",
      office: "Director",
      email: "quiet@example.com",
      phone: "301-555-0142",
      show_email: false,
      order: 99,
      committees: [],
      chairs: [],
      note: "",
      term_start: "2026-01-01",
      term_end: null,
    };
    expect(
      (await call(secretary, "POST", "/api/roster/people", person)).status,
    ).toBe(201);

    const forEditors = await call(editor, "GET", "/api/roster/people");
    expect(forEditors.status).toBe(200);
    const seen = (
      forEditors.json as { name: string; phone: string; email: string }[]
    ).find((p) => p.name === "Quiet Director");
    // The name is needed -- minutes take attendance from this list.
    expect(seen).toBeTruthy();
    expect(seen!.phone).toBe("");
    expect(seen!.email).toBe("");

    const forSecretary = await call(secretary, "GET", "/api/roster/people");
    const full = (forSecretary.json as { name: string; phone: string }[]).find(
      (p) => p.name === "Quiet Director",
    );
    expect(full!.phone).toBe("301-555-0142");
  });
});
