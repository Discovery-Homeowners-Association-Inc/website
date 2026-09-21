import { env } from "cloudflare:workers";
import { beforeAll, expect, test } from "vitest";
import { siteChangeNotifier } from "../src/app.ts";
import { bumpSiteVersion } from "../src/db.ts";
import { runScheduled } from "../src/scheduled.ts";
import { call, makeUser, seedSettings } from "./helpers.ts";

/**
 * The public snapshot builds the whole site in one request -- six queries and
 * the serialization of every published item, 22 to 35 ms of CPU on the deployed
 * Worker against a 10 ms limit -- so it is held in the edge cache.
 *
 * Cheap is worthless if it is wrong. The cache key carries `site_version`, a
 * number every change bumps, so a stale entry is never served: the next
 * request after a change has a key nothing was stored under. That holds for
 * every data center, for the nightly job, and for writes that bypass the
 * Worker, none of which clearing the entry could reach.
 */
beforeAll(async () => {
  await seedSettings();
});

const officeName = async () => {
  const site = await call(null, "GET", "/api/public/site.json");
  expect(site.status).toBe(200);
  return site.json.settings.organization.legal_name as string;
};

const setOfficeNameDirectly = async (name: string) => {
  const row = await env.DB.prepare(
    "select value from settings where key = 'organization'",
  ).first<{ value: string }>();
  const value = JSON.parse(row!.value);
  value.legal_name = name;
  await env.DB.prepare(
    "update settings set value = ?, updated_at = ? where key = 'organization'",
  )
    .bind(JSON.stringify(value), new Date().toISOString())
    .run();
};

test("the snapshot is served from cache instead of rebuilt every time", async () => {
  const before = await officeName();
  await setOfficeNameDirectly("Changed Behind The Cache");
  expect(await officeName()).toBe(before);
});

test("a write that bypasses the app is seen once it bumps the version", async () => {
  const stale = await officeName();
  await setOfficeNameDirectly("Visible After A Bump");
  await bumpSiteVersion(env.DB).run();
  const fresh = await officeName();
  expect(fresh).not.toBe(stale);
  expect(fresh).toBe("Visible After A Bump");
});

test("a change made through the app is seen at once", async () => {
  const admin = await makeUser(["admin"]);
  await officeName();
  const parks = await call(admin, "GET", "/api/settings/parks");
  await call(admin, "PUT", "/api/settings/parks", {
    ...parks.json,
    count: 23,
  });
  const site = await call(null, "GET", "/api/public/site.json");
  expect(site.json.settings.parks.count).toBe(23);
});

test("the nightly job's changes reach the site", async () => {
  const before = (await call(null, "GET", "/api/public/site.json")).json
    .meetings as unknown[];
  await runScheduled(
    env,
    { siteChanged: siteChangeNotifier(async () => {}) },
    new Date("2026-01-05"),
  );
  const after = (await call(null, "GET", "/api/public/site.json")).json
    .meetings as unknown[];
  expect(after.length).toBeGreaterThan(before.length);
});

test("creating a meeting reaches the site", async () => {
  await call(null, "GET", "/api/public/site.json");
  const secretary = await makeUser(["secretary"]);
  const made = await call(secretary, "POST", "/api/meetings", {
    type: "special",
    date: "2029-10-05",
    time: "7:00 pm",
    location: "Discovery Recreation Center",
  });
  expect(made.status).toBe(201);
  const id = made.json.id as string;
  const site = await call(null, "GET", "/api/public/site.json");
  expect(
    (site.json.meetings as { id: string }[]).some((m) => m.id === id),
  ).toBe(true);
});

test("publishing an agenda and canceling a meeting both reach the site", async () => {
  const secretary = await makeUser(["secretary"]);
  const made = await call(secretary, "POST", "/api/meetings", {
    type: "board",
    date: "2029-09-19",
    time: "7:00 pm",
    location: "Discovery Recreation Center",
  });
  expect(made.status).toBe(201);
  const id = made.json.id as string;
  await call(secretary, "PUT", `/api/meetings/${id}/agenda`, {
    base_version: 0,
    body: { items: [{ id: "x", title: "Call to order" }] },
  });
  const onTheSite = async () => {
    const site = await call(null, "GET", "/api/public/site.json");
    return (
      site.json.meetings as { id: string; status: string; agenda: unknown }[]
    ).find((m) => m.id === id);
  };
  await onTheSite();
  expect(
    (await call(secretary, "POST", `/api/meetings/${id}/agenda/publish`))
      .status,
  ).toBe(200);
  const published = await onTheSite();
  expect(published).toBeDefined();
  expect(published!.agenda).not.toBeNull();
  expect(
    (
      await call(secretary, "PATCH", `/api/meetings/${id}`, {
        status: "canceled",
      })
    ).status,
  ).toBe(200);
  expect((await onTheSite())?.status).toBe("canceled");
});
