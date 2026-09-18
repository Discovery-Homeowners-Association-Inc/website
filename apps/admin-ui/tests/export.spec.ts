import AxeBuilder from "@axe-core/playwright";
import { type Browser, expect, test } from "@playwright/test";

/**
 * Taking the association's data out.
 *
 * The file is assembled in the browser, so what these check is that the right
 * data arrives, that the server -- not a hidden checkbox -- is what stops
 * someone reading what they may not, and that the log records the export.
 */
test.describe.configure({ mode: "serial" });

// The same administrator the other specs bootstrap: /api/bootstrap is a
// one-time door, so a spec that invents its own admin has no way in when it
// is not the first to run.
const ADMIN = "secretary@example.com";
const EDITOR = "export-writer@example.com";

async function signIn(browser: Browser, email: string) {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/sign-in/");
  await page.getByLabel("Invited email").fill(email);
  await page.getByRole("button", { name: "Sign in without Google" }).click();
  await expect(page.getByRole("heading", { name: /^Hello/ })).toBeVisible();
  return page;
}

test.beforeAll(async ({ request, browser }) => {
  const res = await request.post("/api/bootstrap", {
    headers: {
      authorization: "Bearer e2e-bootstrap-token-for-tests-only-0123456789",
    },
    data: { email: ADMIN, name: "Sam Secretary" },
  });
  expect([201, 409]).toContain(res.status());

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
  expect(exports[0].detail.datasets.length).toBeGreaterThan(0);
  expect(exports[0].detail.format).toMatch(/^(json|csv)$/);
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
