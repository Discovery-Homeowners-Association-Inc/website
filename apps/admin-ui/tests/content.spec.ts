import { expect, type Page, test } from "@playwright/test";
import {
  ADMIN,
  bootstrap,
  expectAccessible,
  noSidewaysScroll,
  signIn,
} from "./helpers.ts";

/**
 * Site content: an editor writes, a director approves, scheduling and expiry
 * work, settings and the roster are editable, and every screen is usable on a
 * phone. Runs against a seeded throwaway database.
 */
test.describe.configure({ mode: "serial" });

/*
 * The invited identities are this project's own, set before the first test
 * runs. Every browser project works against the same database and a person is
 * unique by email, so a second project inviting the same address is refused
 * and the spec unravels from there. The bootstrapped administrator stays
 * shared: bootstrap is a one-time door and tolerates being already open.
 */
let EDITOR = "";
let DIRECTOR = "";
/** A post title of this project's own, so the second run is not reading the first's. */
let SCHEDULED = "";

let admin: Page;
let editor: Page;
let director: Page;
let newsUrl = "";

test.beforeAll(async ({ request, browser }, testInfo) => {
  EDITOR = `writer-${testInfo.project.name}@example.com`;
  DIRECTOR = `approver-${testInfo.project.name}@example.com`;
  SCHEDULED = `Holiday lights walk (${testInfo.project.name})`;

  await bootstrap(request);
  admin = await signIn(browser, ADMIN);
  await admin.goto("/people/");
  for (const [name, email, role] of [
    ["Wren Writer", EDITOR, "editor"],
    ["Dee Director", DIRECTOR, "board"],
  ] as const) {
    await admin.getByLabel("Name").fill(name);
    await admin.getByLabel("Google account email").fill(email);
    const form = admin
      .locator("form")
      .filter({ has: admin.getByRole("heading", { name: "Invite someone" }) });
    for (const box of await form.getByRole("checkbox").all())
      await box.setChecked(false);
    await admin.locator(`#invite-${role}`).check();
    await admin.getByRole("button", { name: "Invite", exact: true }).click();
    await expect(admin.getByRole("status")).toContainText(`Invited ${email}`);
  }
  editor = await signIn(browser, EDITOR);
  director = await signIn(browser, DIRECTOR);
});

test("the seeded site content is listed with its status", async () => {
  await admin.goto("/content/news/");
  await expect(
    admin.getByRole("link", { name: "Pool passes for 2026 are on sale" }),
  ).toBeVisible();
  await expect(admin.locator(".status--published").first()).toBeVisible();
  await expectAccessible(admin);
});

test("an editor writes a news post and submits it; the editor cannot publish", async () => {
  await editor.goto("/content/news/");
  await editor.getByRole("link", { name: "New news post" }).click();
  await editor.getByLabel("Title").fill("Leaf collection starts Monday");
  await editor
    .getByLabel("Summary")
    .fill("Bag leaves in paper bags and put them out Sunday night.");
  await editor
    .getByLabel("Full text")
    .fill(
      "The county collects leaves on Mondays through November.\n\nPaper bags only.",
    );
  await editor.getByRole("button", { name: "Save as draft" }).click();
  await expect(editor.getByRole("status")).toContainText("Saved as a draft");
  newsUrl = editor.url().replace(/&saved=1$/, "");
  await expect(
    editor.getByRole("button", { name: "Publish", exact: true }),
  ).toBeHidden();
  await editor.getByRole("button", { name: "Submit for approval" }).click();
  await expect(
    editor.getByRole("heading", { name: "Status: Waiting for approval" }),
  ).toBeVisible();
  await expectAccessible(editor);
});

test("a director sees it on the home page, sends it back, then approves the fix", async () => {
  await director.goto("/");
  await expect(
    director.getByRole("heading", { name: "Waiting for approval" }),
  ).toBeVisible();
  await director
    .getByRole("link", { name: /Leaf collection starts Monday/ })
    .click();
  await director.getByLabel("Note for the author").fill("Say which Mondays.");
  await director.getByRole("button", { name: "Send back with a note" }).click();
  await expect(
    director.getByRole("heading", { name: "Status: Draft" }),
  ).toBeVisible();

  await editor.goto(newsUrl);
  await expect(editor.getByText("Sent back: Say which Mondays.")).toBeVisible();
  await editor
    .getByLabel("Summary")
    .fill("Every Monday in October and November, paper bags only.");
  await editor.getByRole("button", { name: "Save changes" }).click();
  await expect(editor.getByRole("status")).toContainText("Saved.");
  await editor.getByRole("button", { name: "Submit for approval" }).click();

  await director.goto(newsUrl);
  await director.getByRole("button", { name: "Approve and publish" }).click();
  await expect(
    director.getByRole("heading", { name: "Status: Published" }),
  ).toBeVisible();
  await expect(
    director.getByRole("link", { name: "View on the site" }),
  ).toHaveAttribute(
    "href",
    /^https:\/\/dhoa-site\.discoveryhomeownersassociation\.workers\.dev\/news\//,
  );
  const site = await director.request.get("/api/public/site.json");
  const json = await site.json();
  expect(
    json.news.map((n: { body: { title: string } }) => n.body.title),
  ).toContain("Leaf collection starts Monday");
});

test("an approver who read an older version is told to read again", async () => {
  await editor.goto("/content/news/edit/");
  await editor.getByLabel("Title").fill("Pool closes early Friday");
  await editor.getByLabel("Summary").fill("Thunderstorms expected.");
  await editor.getByRole("button", { name: "Save as draft" }).click();
  await expect(editor.getByRole("status")).toContainText("Saved as a draft");
  const url = editor.url().replace(/&saved=1$/, "");
  await editor.getByRole("button", { name: "Submit for approval" }).click();
  await director.goto(url);
  await expect(
    director.getByRole("button", { name: "Approve and publish" }),
  ).toBeVisible();
  // The editor changes the pending text under the director's feet.
  await editor
    .getByLabel("Summary")
    .fill("Thunderstorms expected; the pool closes at 4 pm.");
  await editor.getByRole("button", { name: "Save changes" }).click();
  await expect(editor.getByRole("status")).toContainText("Saved.");
  await director.getByRole("button", { name: "Approve and publish" }).click();
  await expect(director.getByRole("alert")).toContainText(
    "changed after you read it",
  );
  await director.reload();
  await director.getByRole("button", { name: "Approve and publish" }).click();
  await expect(
    director.getByRole("heading", { name: "Status: Published" }),
  ).toBeVisible();
});

test("a published post can be taken down and then deleted", async () => {
  await admin.goto(newsUrl);
  admin.once("dialog", (d) => void d.accept());
  await admin.getByRole("button", { name: "Take off the site" }).click();
  await expect(
    admin.getByRole("heading", { name: "Status: Draft" }),
  ).toBeVisible();
  let json = await (await admin.request.get("/api/public/site.json")).json();
  expect(
    json.news.map((n: { body: { title: string } }) => n.body.title),
  ).not.toContain("Leaf collection starts Monday");
  admin.once("dialog", (d) => void d.accept());
  await admin.getByRole("button", { name: /^Delete this/ }).click();
  await admin.waitForURL(/\/content\/news\/$/);
  await expect(
    admin.getByRole("link", { name: "Leaf collection starts Monday" }),
  ).toHaveCount(0);
});

test("sending something back needs a note", async () => {
  await editor.goto("/content/news/edit/");
  await editor.getByLabel("Title").fill("Needs a note");
  await editor.getByLabel("Summary").fill("Summary.");
  await editor.getByRole("button", { name: "Save as draft" }).click();
  await expect(editor.getByRole("status")).toContainText("Saved as a draft");
  const url = editor.url().replace(/&saved=1$/, "");
  await editor.getByRole("button", { name: "Submit for approval" }).click();
  await director.goto(url);
  await director.getByRole("button", { name: "Send back with a note" }).click();
  await expect(director.getByRole("alert")).toContainText("Write a note");
  await expect(
    director.getByRole("heading", { name: "Status: Waiting for approval" }),
  ).toBeVisible();
});

test("a scheduled post stays off the site until its date; an expired one disappears", async () => {
  await admin.goto("/content/events/edit/");
  await admin.getByLabel("Title").fill(SCHEDULED);
  await admin.getByLabel("Summary").fill("A stroll to see the lights.");
  await admin.getByLabel("Starts").fill("2099-12-15T18:00");
  await admin.getByLabel("Ends").fill("2099-12-15T20:00");
  await admin.getByLabel("Publish date").fill("2099-11-01T09:00");
  await admin.getByRole("button", { name: "Save as draft" }).click();
  await expect(admin.getByRole("status")).toContainText("Saved as a draft");
  await admin.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(admin.getByText(/On the site from/)).toBeVisible();
  await admin.goto("/content/events/");
  await expect(
    admin
      .getByRole("listitem")
      .filter({ hasText: SCHEDULED })
      .locator(".status"),
  ).toHaveText("Scheduled");
  let json = await (await admin.request.get("/api/public/site.json")).json();
  expect(
    json.events.map((e: { body: { title: string } }) => e.body.title),
  ).not.toContain(SCHEDULED);

  await admin.goto("/content/events/edit/");
  await admin.getByLabel("Title").fill("Yard sale sign-up");
  await admin.getByLabel("Summary").fill("Sign up by the deadline.");
  await admin.getByLabel("Starts").fill("2026-05-01T09:00");
  await admin.getByLabel("Ends").fill("2026-05-01T12:00");
  await admin.getByLabel("Publish date").fill("2026-01-01T09:00");
  await admin.getByLabel("Hide after (optional)").fill("2026-04-01T09:00");
  await admin.getByRole("button", { name: "Save as draft" }).click();
  await expect(admin.getByRole("status")).toContainText("Saved as a draft");
  await admin.getByRole("button", { name: "Publish", exact: true }).click();
  await admin.goto("/content/events/");
  await expect(
    admin
      .getByRole("listitem")
      .filter({ hasText: "Yard sale sign-up" })
      .locator(".status"),
  ).toHaveText("Expired");
  json = await (await admin.request.get("/api/public/site.json")).json();
  expect(
    json.events.map((e: { body: { title: string } }) => e.body.title),
  ).not.toContain("Yard sale sign-up");
});

test("a document is uploaded and described", async () => {
  await admin.goto("/content/documents/edit/");
  await admin.getByLabel("The file").setInputFiles({
    name: "Pool rules 2027.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 rules"),
  });
  await expect(admin.getByText("Pool rules 2027.pdf")).toBeVisible();
  await admin.getByLabel("Title").fill("Pool rules 2027");
  await admin
    .getByLabel("What it is")
    .fill("The full pool rules for the 2027 season.");
  await admin.getByLabel("Section of the library").selectOption("pool");
  await admin.getByRole("button", { name: "Save as draft" }).click();
  await expect(admin.getByRole("status")).toContainText("Saved as a draft");
  await admin.getByRole("button", { name: "Submit for approval" }).click();
  await director.goto("/");
  await director.getByRole("link", { name: /Pool rules 2027/ }).click();
  await director.getByRole("button", { name: "Approve and publish" }).click();
  await expect(
    director.getByRole("heading", { name: "Status: Published" }),
  ).toBeVisible();
  const json = await (
    await director.request.get("/api/public/site.json")
  ).json();
  const doc = json.documents.find(
    (d: { body: { title: string } }) => d.body.title === "Pool rules 2027",
  );
  expect(doc.file_url).toMatch(/\/api\/public\/files\//);
  const file = await director.request.get(doc.file_url);
  expect(await file.text()).toBe("%PDF-1.4 rules");
});

test("an administrator changes a fact once in site settings", async () => {
  await admin.goto("/settings/");
  await admin.getByRole("link", { name: /^Organization/ }).click();
  const phone = admin.getByLabel("Phone", { exact: true });
  await expect(phone).toHaveValue("301-845-2050");
  await phone.fill("301-845-2051");
  await admin.getByRole("button", { name: "Save changes" }).click();
  await expect(admin.getByRole("status")).toContainText("Saved");
  // Two new email addresses at once. Rows were keyed by their (empty) key, so
  // the second "Add" replaced the first and typing a key ate its neighbor.
  await admin.getByRole("button", { name: "Add email address" }).click();
  await admin.getByRole("button", { name: "Add email address" }).click();
  const keys = admin.getByLabel("Role key");
  const values = admin.getByLabel("Email address", { exact: true });
  const n = await keys.count();
  expect(n).toBeGreaterThanOrEqual(5);
  await keys.nth(n - 2).fill("treasurer");
  await values.nth(n - 2).fill("treasurer@example.com");
  await keys.nth(n - 1).fill("events");
  await values.nth(n - 1).fill("events@example.com");
  await admin.getByRole("button", { name: "Save changes" }).click();
  await expect(admin.getByRole("status")).toContainText("Saved");
  await admin.reload();
  await expect(
    admin.getByLabel("Role key").filter({ hasText: "" }),
  ).toHaveCount(n);
  const saved = await (
    await admin.request.get("/api/settings/organization")
  ).json();
  expect(saved.emails.treasurer).toBe("treasurer@example.com");
  expect(saved.emails.events).toBe("events@example.com");
  const json = await (await admin.request.get("/api/public/site.json")).json();
  expect(json.settings.organization.office.phone).toBe("301-845-2051");
  await expectAccessible(admin);
  await editor.goto("/settings/?group=parks");
  await expect(editor.getByText("Only administrators")).toBeVisible();
});

test("the roster drives attendance in minutes, and ending a term keeps the record", async () => {
  await admin.goto("/roster/");
  await admin.getByRole("button", { name: "Add a person" }).click();
  await expect(admin.getByLabel("Name", { exact: true })).toBeFocused();
  await admin.getByLabel("Name", { exact: true }).fill("Nova Newcomer");
  await admin.getByLabel("Board office").selectOption("Director");
  await admin.getByRole("button", { name: "Add to the roster" }).click();
  await expect(admin.getByRole("status")).toContainText("Added Nova Newcomer");
  await expectAccessible(admin);

  await admin.goto("/meetings/");
  await admin.getByLabel("Date").fill("2026-11-17");
  await admin.getByRole("button", { name: "Add meeting" }).click();
  await admin.getByRole("link", { name: "Minutes for this meeting" }).click();
  await admin
    .getByRole("button", { name: "Start minutes from the agenda" })
    .click();
  const present = admin.getByRole("group", { name: "Directors present" });
  await expect(present.getByLabel("Nova Newcomer")).toBeVisible();
  await expect(present.getByLabel("Valentina Duk")).toBeVisible();
  await present.getByLabel("Nova Newcomer").check();
  await admin.getByLabel("Presiding").selectOption("Valentina Duk");

  await admin.goto("/roster/");
  admin.once("dialog", (d) => void d.accept());
  await admin
    .getByRole("listitem")
    .filter({ hasText: "Nova Newcomer" })
    .getByRole("button", { name: "End term" })
    .click();
  await expect(admin.getByRole("status")).toContainText(
    "term is recorded as ended",
  );
  await admin.getByRole("button", { name: /Show past members/ }).click();
  await expect(
    admin.getByRole("listitem").filter({ hasText: "Nova Newcomer" }),
  ).toBeVisible();
});

test("profile and help pages work, and every new screen fits a phone", async ({
  browser,
}) => {
  await admin.goto("/profile/");
  await admin.getByLabel("Name as it appears to others").fill("Ada A. Admin");
  await admin.getByRole("button", { name: "Save name" }).click();
  await expect(admin.getByRole("status")).toContainText("Name saved.");
  await admin.goto("/help/");
  await expect(admin.getByRole("heading", { name: "Help" })).toBeVisible();
  await expectAccessible(admin);

  const phone = await signIn(browser, ADMIN, true);
  for (const path of [
    "/content/",
    "/content/news/",
    "/content/news/edit/",
    "/content/documents/edit/",
    "/roster/",
    "/settings/?group=organization",
    "/profile/",
    "/help/",
  ]) {
    await phone.goto(path);
    await expect(phone.locator("h1")).toBeVisible();
    await noSidewaysScroll(phone);
    await expectAccessible(phone);
  }
});

test("every settings group renders its form", async () => {
  await admin.goto("/settings/");
  // The settings index is a client:only component; wait for it to hydrate
  // before reading its links, since evaluateAll does not auto-wait.
  await expect(admin.locator(".tasks a").first()).toBeVisible();
  const links = await admin
    .locator(".tasks a")
    .evaluateAll((as) => as.map((a) => a.getAttribute("href")!));
  expect(links.length).toBeGreaterThanOrEqual(11);
  for (const href of links) {
    await admin.goto(href);
    await expect(
      admin.getByRole("button", { name: "Save changes" }),
    ).toBeVisible();
    await expect(admin.getByRole("alert")).toHaveCount(0);
    expect(
      await admin.locator("input, select, textarea").count(),
    ).toBeGreaterThan(0);
    // A schema-derived field can still ask for a phone input: the office
    // phone number is plain text in the schema, but its label says "phone".
    if (href.includes("group=organization"))
      await expect(admin.getByLabel("Phone", { exact: true })).toHaveAttribute(
        "type",
        "tel",
      );
  }
});
