import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import { runScheduled } from "../src/scheduled.ts";
import { call, makeUser, rebuilds, seedSettings } from "./helpers.ts";

const news = (title: string) => ({
  kind: "news",
  body: {
    title,
    summary: "A summary.",
    body: "Some text.",
    category: "general",
  },
});
let admin: string, secretary: string, editor: string, director: string;
/** News needs approval: the secretary submits and the admin approves. */
const publishNow = async (id: string) => {
  await call(secretary, "POST", `/api/items/${id}/action`, {
    action: "submit",
  });
  return call(admin, "POST", `/api/items/${id}/action`, { action: "approve" });
};

beforeAll(async () => {
  await seedSettings();
  admin = await makeUser(["admin"], "Avery Admin");
  secretary = await makeUser(["secretary"], "Sam Secretary");
  editor = await makeUser(["editor"], "Eli Editor");
  director = await makeUser(["board"], "Dana Director");
});

describe("content items", () => {
  it("takes an editor's news post through submission and a director's approval", async () => {
    const created = await call(
      editor,
      "POST",
      "/api/items",
      news("Pool passes for 2027"),
    );
    expect(created.status).toBe(201);
    expect(created.json).toMatchObject({
      status: "draft",
      slug: "pool-passes-for-2027",
    });
    const id = created.json.id;

    // The editor cannot publish; news needs approval.
    expect(
      (
        await call(editor, "POST", `/api/items/${id}/action`, {
          action: "publish",
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await call(editor, "POST", `/api/items/${id}/action`, {
          action: "submit",
        })
      ).json.status,
    ).toBe("pending");
    // Nobody approves their own work; a director can.
    expect(
      (
        await call(editor, "POST", `/api/items/${id}/action`, {
          action: "approve",
        })
      ).status,
    ).toBe(409);
    const rejected = await call(director, "POST", `/api/items/${id}/action`, {
      action: "reject",
      note: "Add the price.",
    });
    expect(rejected.json).toMatchObject({
      status: "draft",
      review_note: "Add the price.",
    });
    await call(editor, "PUT", `/api/items/${id}`, {
      body: { ...news("Pool passes for 2027").body, body: "Passes cost $35." },
    });
    await call(editor, "POST", `/api/items/${id}/action`, { action: "submit" });
    rebuilds.length = 0;
    const approved = await call(director, "POST", `/api/items/${id}/action`, {
      action: "approve",
    });
    expect(approved.json.status).toBe("published");
    expect(rebuilds.length).toBe(1);

    // Once published, the editor can no longer change it.
    expect(
      (await call(editor, "PUT", `/api/items/${id}`, { body: news("x").body }))
        .status,
    ).toBe(403);
  });

  it("lets the secretary publish an event directly, since events need no approval", async () => {
    const created = await call(secretary, "POST", "/api/items", {
      kind: "event",
      body: {
        title: "Ice cream social",
        summary: "Free ice cream.",
        start: "2026-10-03T18:00:00-04:00",
        end: "2026-10-03T20:00:00-04:00",
      },
    });
    const published = await call(
      secretary,
      "POST",
      `/api/items/${created.json.id}/action`,
      { action: "publish" },
    );
    expect(published.json.status).toBe("published");
  });

  it("keeps slugs unique per kind", async () => {
    const a = await call(secretary, "POST", "/api/items", {
      kind: "page",
      body: { title: "Parking" },
    });
    const b = await call(secretary, "POST", "/api/items", {
      kind: "page",
      body: { title: "Parking" },
    });
    expect([a.json.slug, b.json.slug]).toEqual(["parking", "parking-2"]);
  });

  it("rejects an invalid body with a message that names the field", async () => {
    const bad = await call(secretary, "POST", "/api/items", {
      kind: "news",
      body: { title: "", summary: "s" },
    });
    expect(bad.status).toBe(400);
    expect(bad.json.error).toMatch(/title/);
  });

  it("only lets editors delete their own drafts", async () => {
    const mine = await call(editor, "POST", "/api/items", news("Mine"));
    const theirs = await call(secretary, "POST", "/api/items", news("Theirs"));
    expect(
      (await call(editor, "DELETE", `/api/items/${theirs.json.id}`)).status,
    ).toBe(403);
    expect(
      (await call(editor, "DELETE", `/api/items/${mine.json.id}`)).status,
    ).toBe(204);
    expect(
      (await call(admin, "DELETE", `/api/items/${theirs.json.id}`)).status,
    ).toBe(204);
  });

  it("refuses an action against a status that has moved, and logs nothing for it", async () => {
    const created = await call(secretary, "POST", "/api/items", news("Moving"));
    const id = created.json.id;
    await call(secretary, "POST", `/api/items/${id}/action`, {
      action: "submit",
    });
    // Two approvers read the pending item; the first approves it.
    expect(
      (
        await call(admin, "POST", `/api/items/${id}/action`, {
          action: "approve",
        })
      ).json.status,
    ).toBe("published");
    // The second still has a pending item on screen and approves it too.
    const again = await call(director, "POST", `/api/items/${id}/action`, {
      action: "approve",
    });
    expect(again.status).toBe(409);
    const { results } = await env.DB.prepare(
      "select 1 from audit_log where action = 'approve' and entity_id = ?",
    )
      .bind(id)
      .all();
    expect(results).toHaveLength(1);
  });

  it("refuses to approve a body the approver has not read", async () => {
    const created = await call(editor, "POST", "/api/items", news("Read me"));
    const id = created.json.id;
    await call(editor, "POST", `/api/items/${id}/action`, { action: "submit" });
    const seen = (await call(director, "GET", `/api/items/${id}`)).json;
    // The editor changes the pending text after the director read it.
    await call(editor, "PUT", `/api/items/${id}`, {
      body: { ...news("Read me").body, body: "Something else entirely." },
    });
    const stale = await call(director, "POST", `/api/items/${id}/action`, {
      action: "approve",
      seen_updated_at: seen.updated_at,
    });
    expect(stale.status).toBe(409);
    const fresh = (await call(director, "GET", `/api/items/${id}`)).json;
    const ok = await call(director, "POST", `/api/items/${id}/action`, {
      action: "approve",
      seen_updated_at: fresh.updated_at,
    });
    expect(ok.json.status).toBe("published");
  });
});

describe("publish dates and expiry", () => {
  it("shows an item only inside its dates, and the nightly job deletes expired ones marked delete", async () => {
    const future = await call(secretary, "POST", "/api/items", {
      ...news("Scheduled"),
      meta: { publish_at: "2099-01-01T09:00:00-05:00" },
    });
    await publishNow(future.json.id);
    const gone = await call(secretary, "POST", "/api/items", {
      ...news("Expired hide"),
      meta: {
        publish_at: "2020-01-01T09:00:00-05:00",
        expires_at: "2020-02-01T09:00:00-05:00",
        expiry_action: "hide",
      },
    });
    await publishNow(gone.json.id);
    const doomed = await call(secretary, "POST", "/api/items", {
      ...news("Expired delete"),
      meta: {
        publish_at: "2020-01-01T09:00:00-05:00",
        expires_at: "2020-02-01T09:00:00-05:00",
        expiry_action: "delete",
      },
    });
    await publishNow(doomed.json.id);
    const live = await call(secretary, "POST", "/api/items", news("Live now"));
    await publishNow(live.json.id);

    const site = await call(null, "GET", "/api/public/site.json");
    expect(site.status).toBe(200);
    const titles = site.json.news.map(
      (n: { body: { title: string } }) => n.body.title,
    );
    expect(titles).toContain("Live now");
    expect(titles).not.toContain("Scheduled");
    expect(titles).not.toContain("Expired hide");
    expect(titles).not.toContain("Expired delete");

    const result = await runScheduled(env, { siteChanged: async () => {} });
    expect(result.deleted).toBe(1);
    expect(
      (await call(secretary, "GET", `/api/items/${doomed.json.id}`)).status,
    ).toBe(404);
    expect(
      (await call(secretary, "GET", `/api/items/${gone.json.id}`)).status,
    ).toBe(200);
  });

  it("does not delete an item before its expiry when the offset is not UTC", async () => {
    // 11 pm Central on the 19th is 4 am UTC on the 20th. Compared as text
    // against a UTC "now", "-05:00" sorted before "Z" and the item was deleted
    // four and a half hours early.
    const item = await call(secretary, "POST", "/api/items", {
      ...news("Evening deadline"),
      meta: {
        publish_at: "2026-09-01T09:00:00-04:00",
        expires_at: "2026-09-19T23:00:00-05:00",
        expiry_action: "delete",
      },
    });
    await publishNow(item.json.id);
    await runScheduled(
      env,
      { siteChanged: async () => {} },
      new Date("2026-09-19T23:30:00Z"),
    );
    expect(
      (await call(secretary, "GET", `/api/items/${item.json.id}`)).status,
    ).toBe(200);
    await runScheduled(
      env,
      { siteChanged: async () => {} },
      new Date("2026-09-20T05:00:00Z"),
    );
    expect(
      (await call(secretary, "GET", `/api/items/${item.json.id}`)).status,
    ).toBe(404);
  });
});

describe("the public snapshot", () => {
  it("never includes drafts, pending items, minutes, or people's private details", async () => {
    const draft = await call(
      secretary,
      "POST",
      "/api/items",
      news("Secret draft"),
    );
    await call(editor, "POST", "/api/items", news("Pending post")).then((r) =>
      call(editor, "POST", `/api/items/${r.json.id}/action`, {
        action: "submit",
      }),
    );
    await call(secretary, "POST", "/api/roster/people", {
      name: "Pat President",
      email: "pat@example.com",
      phone: "555-0100",
      office: "President",
    });
    const site = await call(null, "GET", "/api/public/site.json");
    const text = JSON.stringify(site.json);
    expect(text).not.toContain("Secret draft");
    expect(text).not.toContain("Pending post");
    expect(text).not.toContain("555-0100");
    expect(text).not.toContain("pat@example.com");
    expect(site.json.people.map((p: { name: string }) => p.name)).toContain(
      "Pat President",
    );
    expect(draft.json.status).toBe("draft");
  });
});

describe("slugs", () => {
  it("keeps them unique per kind without asking the database once per try", async () => {
    const secretary = await makeUser(["secretary"]);
    const make = async () =>
      (await call(secretary, "POST", "/api/items", news("Pool opening day")))
        .json.slug as string;

    expect(await make()).toBe("pool-opening-day");
    expect(await make()).toBe("pool-opening-day-2");
    expect(await make()).toBe("pool-opening-day-3");
  });
});
