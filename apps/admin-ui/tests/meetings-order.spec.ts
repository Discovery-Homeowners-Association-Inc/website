import { expect, test } from "@playwright/test";
import { ADMIN, bootstrap, signIn } from "./helpers.ts";

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

test.beforeAll(async ({ request }) => {
  await bootstrap(request);
});

test("the next meeting is first, and what has happened comes after", async ({
  browser,
}) => {
  const page = await signIn(browser, ADMIN);

  /*
   * Dates of this spec's own: a meeting is unique by date and type. Firefox
   * never runs this spec (see the `firefox` project's testMatch in
   * playwright.config.ts), so one set of dates is enough.
   */
  const future = ["2031-06-17", "2030-02-19"];
  const past = "2019-04-16";

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
