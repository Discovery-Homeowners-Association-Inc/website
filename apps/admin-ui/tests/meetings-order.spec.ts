import { type Browser, expect, test } from "@playwright/test";

/**
 * The meetings list is ordered for the work, not by date alone.
 *
 * A flat newest-first list was right when the table only held meetings that had
 * happened. The schedule now fills a year ahead, so newest-first put next
 * August at the top and buried the meeting the board is actually working on.
 * The two jobs sit next to today -- an agenda for the next meeting, minutes for
 * the one just held -- so each is the first row of its group.
 */
test.describe.configure({ mode: "serial" });

const ADMIN = "secretary@example.com";

async function signIn(browser: Browser, email: string) {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/sign-in/");
  await page.getByLabel("Invited email").fill(email);
  await page.getByRole("button", { name: "Sign in without Google" }).click();
  await expect(page.getByRole("heading", { name: /^Hello/ })).toBeVisible();
  return page;
}

test.beforeAll(async ({ request }) => {
  const res = await request.post("/api/bootstrap", {
    headers: {
      authorization: "Bearer e2e-bootstrap-token-for-tests-only-0123456789",
    },
    data: { email: ADMIN, name: "Sam Secretary" },
  });
  expect([201, 409]).toContain(res.status());
});

test("the next meeting is first, and what has happened comes after", async ({
  browser,
}, testInfo) => {
  const page = await signIn(browser, ADMIN);

  /*
   * Dates of this spec's own, per browser: the suite runs every project
   * against one database, and a meeting is unique by date and type, so fixed
   * dates mean the second project cannot create what it needs.
   */
  const era = testInfo.project.name === "firefox" ? 1 : 0;
  const future = [`${2031 + era * 10}-06-17`, `${2030 + era * 10}-02-19`];
  const past = `${2019 - era * 10}-04-16`;

  // Two far-future meetings and one long past, created out of order.
  // Adding one takes you to its own page, so each round trips back to the list.
  for (const date of [...future, past]) {
    await page.goto("/meetings/");
    await page.getByLabel("Date").fill(date);
    await page.getByRole("button", { name: "Add meeting" }).click();
    await page.waitForURL(/\/meeting\/\?id=/);
  }

  await page.goto("/meetings/");
  // The list is an island: wait for it rather than reading an empty table.
  await expect(page.locator("tbody tr").first()).toBeVisible();
  const groupsAndDates = await page.evaluate(() =>
    [...document.querySelectorAll("tbody tr")].map(
      (r) =>
        r.querySelector("th")?.textContent?.trim() ??
        r.querySelector("td a")?.textContent?.trim() ??
        "",
    ),
  );

  const upcomingAt = groupsAndDates.indexOf("Upcoming");
  const pastAt = groupsAndDates.indexOf("Past");
  expect(upcomingAt, "no Upcoming group").toBeGreaterThanOrEqual(0);
  expect(pastAt, "no Past group").toBeGreaterThan(upcomingAt);

  // Nearest upcoming first, and the 2031 one after the 2030 one.
  const upcoming = groupsAndDates.slice(upcomingAt + 1, pastAt);
  const earlier = upcoming.findIndex((d) => d.includes(future[1]!.slice(0, 4)));
  const later = upcoming.findIndex((d) => d.includes(future[0]!.slice(0, 4)));
  expect(
    earlier,
    "the nearer meeting is missing from Upcoming",
  ).toBeGreaterThanOrEqual(0);
  expect(later, "the later meeting is not after it").toBeGreaterThan(earlier);

  // What has already happened is below, not above.
  expect(groupsAndDates.slice(pastAt + 1).join(" ")).toContain(
    past.slice(0, 4),
  );
});
