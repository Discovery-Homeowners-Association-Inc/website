import AxeBuilder from "@axe-core/playwright";
import { type Browser, expect, type Page, test } from "@playwright/test";

/**
 * One board meeting, followed from creation to minutes filed in PayHOA, by the
 * people who would really do each step. Sign-in uses the developer endpoint,
 * which exists only on local http servers.
 */
test.describe.configure({ mode: "serial" });

/*
 * Invited identities are this project's own. Every browser project runs
 * against the same database, and a person is unique by email, so a second
 * project inviting the same address is refused and the whole spec unravels.
 * The bootstrapped administrator stays shared, because bootstrap is a
 * one-time door and tolerates having already been opened.
 */
/*
 * The invited identities are this project's own, set before the first test
 * runs. Every browser project works against the same database and a person is
 * unique by email, so a second project inviting the same address is refused
 * and the spec unravels from there. The bootstrapped administrator stays
 * shared: bootstrap is a one-time door and tolerates being already open.
 */
const ADMIN = "secretary@example.com";
let DIRECTOR = "";
let EDITOR = "";
/** A meeting date of this project's own: a meeting is unique by date and type. */
let MEETING_DATE = "";

async function signIn(browser: Browser, email: string) {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/sign-in/");
  await page.getByLabel("Invited email").fill(email);
  await page.getByRole("button", { name: "Sign in without Google" }).click();
  await expect(page.getByRole("heading", { name: /^Hello/ })).toBeVisible();
  return page;
}

async function expectAccessible(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    violations.map(
      (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
    ),
  ).toEqual([]);
}

let admin: Page;
let director: Page;
let minutesUrl = "";

test.beforeAll(async ({ request }, testInfo) => {
  DIRECTOR = `director-${testInfo.project.name}@example.com`;
  EDITOR = `editor-${testInfo.project.name}@example.com`;
  MEETING_DATE =
    testInfo.project.name === "firefox" ? "2036-10-20" : "2026-10-20";

  const res = await request.post("/api/bootstrap", {
    headers: {
      authorization: "Bearer e2e-bootstrap-token-for-tests-only-0123456789",
    },
    data: { email: ADMIN, name: "Sam Secretary" },
  });
  // 409 when another browser project has already run against this database.
  expect([201, 409]).toContain(res.status());
});

test("anonymous visitors are sent to sign in", async ({ page }) => {
  await page.goto("/meetings/");
  await expect(page).toHaveURL(/\/sign-in\/\?next=%2Fmeetings%2F/);
  await expectAccessible(page);
});

test("a Google account that was not invited is refused with an explanation", async ({
  page,
}) => {
  await page.goto("/sign-in/?error=signup_disabled");
  await expect(page.getByRole("alert")).toContainText("has not been invited");
});

test("the administrator invites a director and an editor", async ({
  browser,
}) => {
  admin = await signIn(browser, ADMIN);
  await admin.getByRole("link", { name: "Accounts" }).click();
  await expectAccessible(admin);
  for (const [name, email, role] of [
    ["Dana Director", DIRECTOR, "board"],
    ["Eli Editor", EDITOR, "editor"],
  ] as const) {
    await admin.getByLabel("Name").fill(name);
    await admin.getByLabel("Google account email").fill(email);
    const inviteForm = admin
      .locator("form")
      .filter({ has: admin.getByRole("heading", { name: "Invite someone" }) });
    for (const box of await inviteForm.getByRole("checkbox").all())
      await box.setChecked(false);
    await admin.locator(`#invite-${role}`).check();
    await admin.getByRole("button", { name: "Invite", exact: true }).click();
    await expect(admin.getByRole("status")).toContainText(`Invited ${email}`);
  }
  await expect(
    admin.getByRole("listitem").filter({ hasText: EDITOR }),
  ).toContainText("editor. Has not signed in");
});

test("the administrator also acts as secretary: add a meeting and publish its agenda", async () => {
  await admin
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Meetings" })
    .click();
  await admin.getByLabel("Date").fill(MEETING_DATE);
  await admin.getByRole("button", { name: "Add meeting" }).click();
  await expect(admin).toHaveURL(
    new RegExp(`/meeting/\\?id=${MEETING_DATE}-board`),
  );

  await admin.getByRole("button", { name: "Add an item" }).click();
  await admin.getByLabel("Item title").nth(1).fill("Treasurer's report");
  await admin.getByRole("button", { name: "Save agenda" }).click();
  await expect(admin.getByRole("status")).toContainText("Saved as version 1");
  await admin.getByRole("button", { name: "Publish this version" }).click();
  await expect(admin.getByText("Version 1 is published.")).toBeVisible();
  await expectAccessible(admin);
});

test("the secretary drafts minutes and sends them for review", async () => {
  await admin.getByRole("link", { name: "Minutes for this meeting" }).click();
  await admin
    .getByRole("button", { name: "Start minutes from the agenda" })
    .click();
  await expect(admin.getByText(/^Version 1, saved/)).toBeVisible();
  minutesUrl = admin.url();

  await admin.getByLabel("Called to order at").fill("7:02 pm");
  await admin.getByLabel("Presiding").selectOption("Valentina Duk");
  const present = admin.getByRole("group", { name: "Directors present" });
  await present.getByLabel("Valentina Duk").check();
  await present.getByLabel("Doug Shoemaker").check();
  await present.getByLabel("Add a name").fill("Pat President");
  await present.getByRole("button", { name: "Add" }).click();
  await admin.getByLabel("A quorum was present").check();
  await admin
    .getByLabel("Discussion")
    .nth(1)
    .fill("The treasurer reported the operating balance.");
  await admin.getByLabel("What changed").fill("First full draft");
  await admin.getByRole("button", { name: "Save a new version" }).click();
  await expect(admin.getByRole("status")).toContainText("Saved a new version.");
  await admin.getByRole("button", { name: "Send for review" }).click();
  await expect(
    admin.getByRole("heading", { name: "Status: In review" }),
  ).toBeVisible();
  await expectAccessible(admin);
});

test("an editor cannot see minutes or the People page", async ({ browser }) => {
  const editor = await signIn(browser, EDITOR);
  await expect(editor.getByRole("link", { name: "People" })).toBeHidden();
  await expect(editor.getByText("Minutes waiting on the board")).toBeHidden();
  await editor.goto(minutesUrl);
  await expect(editor.getByRole("alert")).toContainText(
    "do not have permission",
  );
});

test("a director comments and marks the version reviewed", async ({
  browser,
}) => {
  director = await signIn(browser, DIRECTOR);
  await expect(director.getByRole("link", { name: "People" })).toBeHidden();
  await director
    .getByRole("link", { name: /Board meeting, Tuesday, October 20, 2026/ })
    .first()
    .click();
  await expect(
    director.getByRole("heading", { name: "Reviewed version 2" }),
  ).toBeVisible();
  await expect(
    director.getByRole("button", { name: "Save a new version" }),
  ).toBeHidden();
  await director
    .getByLabel("About")
    .selectOption({ label: "Item 2: Treasurer's report" });
  await director
    .getByLabel("Comment", { exact: true })
    .fill("Please include the balance amount.");
  await director.getByRole("button", { name: "Add comment" }).click();
  await expect(director.getByRole("status")).toContainText("Comment added.");
  await director
    .getByRole("button", { name: "I have reviewed this version" })
    .click();
  await expect(
    director.getByRole("listitem").filter({ hasText: "Dana Director" }).first(),
  ).toBeVisible();
  await expectAccessible(director);
});

test("the secretary revises, and the board approves the exact version at the meeting", async () => {
  await admin.reload();
  await expect(
    admin.getByText("Please include the balance amount."),
  ).toBeVisible();
  // The roster arrives after the minutes. A picker that decided "someone else"
  // before it arrived showed every saved director as a stranger.
  await expect(admin.getByLabel("Presiding", { exact: true })).toHaveValue(
    "Valentina Duk",
  );
  await expect(admin.getByLabel("Presiding, name")).toHaveCount(0);
  await admin
    .getByLabel("Discussion")
    .nth(1)
    .fill("The treasurer reported an operating balance of $48,210.");
  await admin.getByLabel("What changed").fill("Added the balance");
  await admin.getByRole("button", { name: "Save a new version" }).click();
  await expect(admin.getByRole("status")).toContainText("Saved a new version.");
  await admin.getByRole("button", { name: "Resolve" }).click();
  await admin.getByRole("button", { name: "Ready for a vote" }).click();

  // 11:30 pm on a December evening in Maryland is already tomorrow in UTC. The
  // vote date is what goes into the approved minutes, so it has to be today.
  await director.clock.setFixedTime(new Date("2026-12-15T23:30:00-05:00"));

  await director.reload();
  await expect(director.getByLabel("Date of the vote")).toHaveValue(
    "2026-12-15",
  );
  await director
    .getByLabel("Motion to approve moved by")
    .selectOption("Valentina Duk");
  await director.getByLabel("Seconded by").selectOption("__other");
  await director.getByLabel("Seconded by, name").fill("Sam Secretary");
  await director.getByLabel("In favor").fill("3");

  // A late amendment at the meeting makes the director's open page stale.
  await admin.reload();
  await admin.getByLabel("Adjourned at").fill("8:15 pm");
  await admin.getByRole("button", { name: "Save a new version" }).click();
  await expect(admin.getByRole("status")).toContainText("Saved a new version.");

  await director
    .getByRole("button", { name: "Record vote and approve" })
    .click();
  await expect(director.getByRole("alert")).toContainText(
    "changed after you opened them",
  );

  await director.reload();
  await director
    .getByLabel("Motion to approve moved by")
    .selectOption("Valentina Duk");
  await director.getByLabel("Seconded by").selectOption("__other");
  await director.getByLabel("Seconded by, name").fill("Sam Secretary");
  await director.getByLabel("In favor").fill("3");
  await director
    .getByRole("button", { name: "Record vote and approve" })
    .click();
  await expect(director.getByRole("status")).toContainText(
    "Approved. The minutes are now locked.",
  );
});

test("approved minutes export for PayHOA and are marked filed", async () => {
  await admin.reload();
  await expect(
    admin.getByRole("button", { name: "Save a new version" }),
  ).toBeHidden();
  const [exportPage] = await Promise.all([
    admin.waitForEvent("popup"),
    admin.getByRole("link", { name: "Export PDF" }).click(),
  ]);
  await expect(
    exportPage.getByText(
      "These minutes were approved by the Board of Directors",
    ),
  ).toBeVisible();
  await expect(
    exportPage.getByText("operating balance of $48,210"),
  ).toBeVisible();
  await expect(exportPage.getByText("adjourned at 8:15 pm")).toBeVisible();
  await expectAccessible(exportPage);
  await exportPage.close();

  await admin
    .getByLabel("Where it was uploaded")
    .fill("PayHOA > Documents > Board minutes");
  await admin
    .getByRole("button", { name: "Mark as uploaded to PayHOA" })
    .click();
  await expect(
    admin.getByRole("heading", { name: "Status: Filed in PayHOA" }),
  ).toBeVisible();
});

test("removing someone keeps them on record as a former member, and access can be restored", async ({
  browser,
}) => {
  await admin.goto("/people/");
  admin.once("dialog", (d) => void d.accept());
  await admin
    .getByRole("listitem")
    .filter({ hasText: DIRECTOR })
    .getByRole("button", { name: "Remove access" })
    .click();
  await expect(admin.getByRole("status")).toContainText(
    "listed under former members",
  );
  const former = admin.getByRole("heading", { name: "Former members" });
  await expect(former).toBeVisible();
  await expectAccessible(admin);

  // Their review history still carries their name.
  await admin.goto(minutesUrl);
  await admin.getByRole("button", { name: "Show resolved" }).click();
  await expect(
    admin.getByText("Dana Director (former member)").first(),
  ).toBeVisible();

  // Their session ended, and signing in again does not give them access.
  await director.goto("/");
  await expect(director).toHaveURL(/\/sign-in\//);
  await director.getByLabel("Invited email").fill(DIRECTOR);
  await director
    .getByRole("button", { name: "Sign in without Google" })
    .click();
  await expect(director.getByRole("alert")).toContainText(
    "access has been removed",
  );

  // Restore.
  await admin.goto("/people/");
  const row = admin.getByRole("listitem").filter({ hasText: DIRECTOR });
  await row.getByRole("button", { name: "Restore access" }).click();
  await admin.getByRole("button", { name: "Restore access" }).click();
  await expect(admin.getByRole("status")).toContainText(
    "Restored Dana Director's access",
  );
  const back = await signIn(browser, DIRECTOR);
  await expect(back.getByRole("heading", { name: /^Hello/ })).toBeVisible();
});

test("works on a phone: readable navigation, no sideways scrolling, actions before the document", async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const phone = await (
    await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    })
  ).newPage();
  await phone.goto("/sign-in/");
  await phone.getByLabel("Invited email").fill(ADMIN);
  await phone.getByRole("button", { name: "Sign in without Google" }).click();
  await expect(phone.getByRole("heading", { name: /^Hello/ })).toBeVisible();

  for (const path of [
    "/",
    "/meetings/",
    "/people/",
    minutesUrl.replace(/^https?:\/\/[^/]+/, ""),
  ].filter(Boolean)) {
    await phone.goto(path);
    await expect(phone.locator("h1")).toBeVisible();
    const overflow = await phone.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow, `sideways scroll on ${path}`).toBeLessThanOrEqual(0);

    // On a phone the links sit behind the Menu button, as on the public site.
    await phone.locator(".nav-toggle").click();
    // Navigation links never overlap each other, whichever rows they wrap onto.
    const nav = phone.getByRole("navigation", { name: "Main" });
    const boxes = [];
    for (const name of [
      "Home",
      "Content",
      "Meetings",
      "Roster",
      "Accounts",
      "Settings",
      "Help",
    ]) {
      const box = await nav
        .getByRole("link", { name, exact: true })
        .boundingBox();
      expect(box, `${name} link visible on ${path}`).not.toBeNull();
      boxes.push(box!);
    }
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!,
          b = boxes[j]!;
        const apart =
          a.x + a.width + 8 <= b.x ||
          b.x + b.width + 8 <= a.x ||
          a.y + a.height <= b.y ||
          b.y + b.height <= a.y;
        expect(apart, `nav links overlap on ${path}`).toBe(true);
      }
    }
  }

  // On the minutes page the status panel comes before the document.
  const status = await phone
    .getByRole("heading", { name: /^Status:/ })
    .boundingBox();
  const firstItem = await phone.locator(".workspace-doc").boundingBox();
  expect(status!.y).toBeLessThan(firstItem!.y);
  await expectAccessible(phone);
});

test("a remembered administrator's header never changes height while a page loads", async () => {
  // admin has visited pages already, so the role is remembered in this browser.
  // Over a real network the role check takes a moment; locally it answers
  // before the first frame, which would hide the flicker this test is about.
  await admin.route("**/api/me", async (route) => {
    await new Promise((r) => setTimeout(r, 500));
    await route.continue();
  });
  await admin.addInitScript(() => {
    const w = window as unknown as { __heights: number[] };
    w.__heights = [];
    const tick = () => {
      const header = document.querySelector(".site-header");
      if (header) {
        const h = Math.round(header.getBoundingClientRect().height);
        if (w.__heights.at(-1) !== h) w.__heights.push(h);
      }
      if (performance.now() < 3000) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  for (const width of [390, 900, 1366]) {
    await admin.setViewportSize({ width, height: 800 });
    await admin.goto("/content/");
    // Below 44rem the links sit behind the Menu button. Opening the panel
    // cannot change the header's height: the panel is positioned over the page.
    const toggle = admin.locator(".nav-toggle");
    if (await toggle.isVisible()) await toggle.click();
    await expect(
      admin
        .getByRole("navigation", { name: "Main" })
        .getByRole("link", { name: "Settings", exact: true }),
    ).toBeVisible();
    await admin.waitForTimeout(500);
    const heights = await admin.evaluate(
      () => (window as unknown as { __heights: number[] }).__heights,
    );
    expect(heights, `header heights while loading at ${width}px`).toHaveLength(
      1,
    );
  }
});
