import { env } from "cloudflare:workers";
import { beforeAll, expect, test } from "vitest";
import { invalidateSnapshot } from "../src/routes/public.ts";
import { call, makeUser, seedSettings, snapshotCache } from "./helpers.ts";

/**
 * The public snapshot builds the whole site in one request: five queries and
 * the serialisation of every published item. Measured on the deployed Worker it
 * costs 22 to 35 ms of CPU against a 10 ms Workers Free limit, so it is held in
 * the edge cache rather than rebuilt for every caller.
 *
 * Cheap is worthless if it is wrong. The site build runs straight after a
 * publish, so a stale snapshot would rebuild the site from its previous state.
 * Every content change clears the entry; `settings-roster-files.test.ts` proves
 * that wiring end to end by editing through a route and reading the snapshot.
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
  // Changed behind the route's back: a cached response cannot see this, a
  // rebuilt one would.
  await setOfficeNameDirectly("Changed Behind The Cache");
  expect(await officeName()).toBe(before);
});

test("clearing the cache makes the next request see the change", async () => {
  const stale = await officeName();
  await setOfficeNameDirectly("Visible After Invalidation");
  await invalidateSnapshot(env, snapshotCache);
  const fresh = await officeName();
  expect(fresh).not.toBe(stale);
  expect(fresh).toBe("Visible After Invalidation");
});

test("publishing an agenda and canceling a meeting both reach the site", async () => {
  // The meetings routes had no way to say the site had changed, so a published
  // agenda or a called-off meeting sat behind the cache until some unrelated
  // edit happened to clear it. Residents were told a canceled meeting was on.
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
    return (site.json.meetings as { id: string; status: string }[]).find(
      (m) => m.id === id,
    );
  };

  // Warm the cache so a stale entry would be the failure mode.
  await onTheSite();
  expect(
    (await call(secretary, "POST", `/api/meetings/${id}/agenda/publish`))
      .status,
  ).toBe(200);
  expect(await onTheSite()).toBeTruthy();

  await onTheSite();
  expect(
    (
      await call(secretary, "PATCH", `/api/meetings/${id}`, {
        status: "canceled",
      })
    ).status,
  ).toBe(200);
  expect((await onTheSite())?.status).toBe("canceled");
});
