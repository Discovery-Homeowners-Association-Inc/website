import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const pages = [
  "/",
  "/meetings/",
  "/dues/",
  "/amenities/",
  "/amenities/pool/",
  "/amenities/recreation-center/",
  "/amenities/rv-lot/",
  "/amenities/parks/",
  "/rules/",
  "/rules/architectural-control/",
  "/rules/trash-recycling/",
  "/rules/report-a-problem/",
  "/board/",
  "/board/projects/",
  "/documents/",
  "/news/",
  "/contact/",
  "/contact/committees/",
  "/contact/community-links/",
  "/about/",
  "/about/history/",
  "/about/welcome-committee/",
];

for (const path of pages) {
  test.describe(path, () => {
    test("has no detectable accessibility violations", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(path);
      const { violations } = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(
        violations.map(
          (v) =>
            `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
        ),
      ).toEqual([]);
    });

    test("has exactly one h1 and does not scroll sideways on a phone", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(path);
      await expect(page.locator("h1")).toHaveCount(1);
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  });
}

test("dark mode passes accessibility checks on the home page", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto("/");
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(violations.map((v) => v.id)).toEqual([]);
});

test("the menu button opens the navigation on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const menu = page.getByRole("button", { name: "Menu" });
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav).toBeHidden();
  await menu.click();
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  await expect(
    nav.getByRole("link", { name: "Meetings", exact: true }),
  ).toBeVisible();
});

test("the calendar feed is valid iCalendar", async ({ request }) => {
  const res = await request.get("/calendar.ics");
  expect(res.ok()).toBe(true);
  const body = await res.text();
  expect(body.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
  expect(body.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
  expect(body).toContain("SUMMARY:Board of directors meeting");
});

test("every internal link resolves", async ({ page, request }) => {
  const seen = new Set<string>();
  for (const path of pages) {
    await page.goto(path);
    for (const href of await page
      .locator("a[href^='/']")
      .evaluateAll((as) => as.map((a) => a.getAttribute("href")!))) {
      seen.add(href.split("#")[0]!);
    }
  }
  const broken: string[] = [];
  for (const href of seen) {
    const res = await request.get(href);
    if (!res.ok()) broken.push(`${href} ${res.status()}`);
  }
  expect(broken).toEqual([]);
});
