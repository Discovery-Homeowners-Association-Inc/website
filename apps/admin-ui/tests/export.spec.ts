import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { ADMIN, bootstrap, signIn } from "./helpers.ts";

/**
 * Taking the association's data out.
 *
 * The file is assembled in the browser, so what these check is that the right
 * data arrives, that the server -- not a hidden checkbox -- is what stops
 * someone reading what they may not, and that the log records the export.
 */
test.describe.configure({ mode: "serial" });

const EDITOR = "export-writer@example.com";

test.beforeAll(async ({ request, browser }) => {
  await bootstrap(request);

  // Through the API rather than the invite form: this is setup, and it has to
  // be safe whether or not another spec has already run against this database.
  const admin = await signIn(browser, ADMIN);
  const invited = await admin.request.post("/api/users", {
    data: {
      email: EDITOR,
      name: "Eddie Editor",
      grants: [{ role: "editor" }],
    },
  });
  expect([200, 201, 409]).toContain(invited.status());
  await admin.close();
});

test("an administrator can take everything, and gets a JSON file", async ({
  browser,
}) => {
  const page = await signIn(browser, ADMIN);
  await page.goto("/export/");
  for (const label of ["Roster and committees", "Sign-in accounts"])
    await page.getByRole("checkbox", { name: label }).check();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(
    /^discovery-\d{4}-\d{2}-\d{2}\.json$/,
  );

  const body = JSON.parse(
    await (
      await import("node:fs/promises")
    ).readFile((await file.path()) ?? "", "utf8"),
  );
  expect(body.exported_by).toBe(ADMIN);
  expect(Object.keys(body.data).sort()).toEqual(["accounts", "roster"]);
  expect(Array.isArray(body.data.roster.people)).toBe(true);
  expect(
    body.data.accounts.some((a: { email: string }) => a.email === ADMIN),
  ).toBe(true);

  await expect(page.getByText(/in the log/)).toBeVisible();
  await page.close();
});

test("a CSV is one table, and it is a real CSV", async ({ browser }) => {
  const page = await signIn(browser, ADMIN);
  await page.goto("/export/");
  await page.getByLabel("Format").selectOption("csv");
  await page.getByLabel("Which table").selectOption("committees");

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^discovery-committees-/);

  const text = await (
    await import("node:fs/promises")
  ).readFile((await file.path()) ?? "", "utf8");
  expect(text.startsWith("﻿")).toBe(true); // so Excel reads the UTF-8
  const header = text.slice(1).split("\r\n")[0] ?? "";
  expect(header).toContain("name");
  await page.close();
});

test("meetings and minutes come out whole, including the ones with neither", async ({
  browser,
}) => {
  // These two walk every meeting and ask for its agenda and its minutes, so
  // they are the paths that break on a meeting that has neither -- which most
  // of a year's schedule is.
  const page = await signIn(browser, ADMIN);
  // The schedule is materialized by a cron that does not run locally, so a
  // fresh database has no meetings. One is enough to walk the path.
  const made = await page.request.post("/api/meetings", {
    data: {
      type: "board",
      date: "2029-03-20",
      time: "7:00 pm",
      location: "Discovery Recreation Center",
    },
  });
  expect([200, 201, 409]).toContain(made.status());

  await page.goto("/export/");
  await page.getByRole("checkbox", { name: "Roster and committees" }).uncheck();
  await page.getByRole("checkbox", { name: "Meetings and agendas" }).check();
  await page
    .getByRole("checkbox", { name: "Minutes, including drafts" })
    .check();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download" }).click();
  const body = JSON.parse(
    await (
      await import("node:fs/promises")
    ).readFile((await (await download).path()) ?? "", "utf8"),
  );

  expect(body.data.meetings.meetings.length).toBeGreaterThan(0);
  // One agenda entry per meeting, each naming the meeting it belongs to.
  expect(body.data.meetings.agendas.length).toBe(
    body.data.meetings.meetings.length,
  );
  expect(body.data.meetings.agendas[0].meeting_id).toBeTruthy();
  expect(body.data.minutes.length).toBe(body.data.meetings.meetings.length);
  await page.close();
});

test("the export is written to the audit log", async ({ browser }) => {
  const page = await signIn(browser, ADMIN);
  const log = await page.request.get("/api/audit");
  expect(log.ok()).toBe(true);
  const rows = await log.json();
  const exports = rows.filter((r: { action: string }) => r.action === "export");
  expect(exports.length).toBeGreaterThan(0);
  // Against who is signed in, not a name: whether this account is the seeded
  // one or the bootstrapped one depends on what else has run first.
  const me = await (await page.request.get("/api/me")).json();
  expect(exports[0].actor_id).toBe(me.id);
  expect(exports[0].actor).toBe(me.name);
  // The endpoint sends detail as stored JSON text; parsing it is the caller's
  // job, so that a Worker with 10 ms does not do it two thousand times.
  const detail = JSON.parse(exports[0].detail);
  expect(detail.datasets.length).toBeGreaterThan(0);
  expect(detail.format).toMatch(/^(json|csv)$/);
  await page.close();
});

test("an editor is not offered, and cannot take, what it may not read", async ({
  browser,
}) => {
  const page = await signIn(browser, EDITOR);
  await page.goto("/export/");
  await expect(
    page.getByRole("checkbox", { name: "Roster and committees" }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "Sign-in accounts" }),
  ).toHaveCount(0);

  // The checkbox is a convenience; the server is the control.
  const refused = await page.request.get("/api/users");
  expect(refused.status()).toBe(403);
  const noLog = await page.request.get("/api/audit");
  expect(noLog.status()).toBe(403);
  await page.close();
});

test("the export screen has no accessibility violations", async ({
  browser,
}) => {
  const page = await signIn(browser, ADMIN);
  await page.goto("/export/");
  await expect(page.getByRole("button", { name: "Download" })).toBeVisible();
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    violations.map(
      (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
    ),
  ).toEqual([]);
  await page.close();
});
