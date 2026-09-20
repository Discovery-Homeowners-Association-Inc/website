import { readdirSync, readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const site = JSON.parse(readFileSync("content/site.json", "utf8"));
const officePhone: string = site.settings.organization.office.phone;
const countyRecyclingUrl: string =
  site.settings.organization.external.county_recycling.url;

const firstMeeting = readdirSync("dist/meetings").find((d) =>
  /^\d{4}-/.test(d),
);

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
  "/privacy/",
  "/terms/",
  "/404.html",
  "/news/water-main-phase-1/",
  "/events/pool-opening/",
  ...(firstMeeting ? [`/meetings/${firstMeeting}/`] : []),
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

for (const path of ["/", "/amenities/parks/", "/rules/report-a-problem/"]) {
  test(`dark mode passes accessibility checks on ${path}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    await page.goto(path);
    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(violations.map((v) => v.id)).toEqual([]);
  });
}

test("the menu button opens the navigation on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  // Located by class, not by name: the label swaps to "Close" when it opens.
  const menu = page.locator(".nav-toggle");
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav).toBeHidden();
  await menu.click();
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  await expect(menu).toHaveText("Close");
  await expect(
    nav.getByRole("link", { name: "Meetings", exact: true }),
  ).toBeVisible();
  // The action moved into the panel, so it is reachable there too.
  await expect(page.getByRole("link", { name: "Pay dues" })).toBeVisible();
});

test("every document link says what it is, and a Spanish one says so", async ({
  page,
}) => {
  await page.goto("/documents/");
  const links = page.locator(".tasks a[href^='/documents/']");
  expect(await links.count()).toBeGreaterThan(0);
  for (const text of await links.allInnerTexts())
    expect(text).toMatch(/\((PDF|image)(, Spanish)?\)$/);
});

test("a meeting is a link only once its agenda is posted", async ({ page }) => {
  await page.goto("/meetings/");
  const items = page.locator(".dated li");
  expect(await items.count()).toBeGreaterThan(0);
  for (let i = 0; i < (await items.count()); i++) {
    const item = items.nth(i);
    const linked = (await item.locator("h3 a").count()) > 0;
    const posted = (await item.innerText()).includes("The agenda is posted.");
    expect(linked, `item ${i}: linked=${linked} posted=${posted}`).toBe(posted);
  }
});

if (firstMeeting) {
  test("a meeting page's Attending panel states that meeting's own time, not the board's", async ({
    page,
  }) => {
    await page.goto(`/meetings/${firstMeeting}/`);
    const summary = await page.locator(".page-head p").innerText();
    const firstDd = await page.locator("aside.panel dl dd").first().innerText();
    const time = summary.match(/\d{1,2}:\d{2}\s*(am|pm)/i)?.[0];
    expect(time).toBeTruthy();
    expect(firstDd).toContain(time);
  });
}

test("the office phone is always a dialable +1 link", async ({ page }) => {
  for (const path of [
    "/",
    "/404.html",
    "/contact/",
    "/rules/report-a-problem/",
  ]) {
    await page.goto(path);
    const officeLinks = page.locator("a[href^='tel:']", {
      hasText: officePhone,
    });
    const count = await officeLinks.count();
    expect(count, `no office-number link found on ${path}`).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const text = (await officeLinks.nth(i).innerText()).trim();
      if (text !== officePhone) continue;
      await expect(officeLinks.nth(i)).toHaveAttribute("href", /^tel:\+1/);
    }
  }
});

test("the meetings page opens with why to come, not a bare list of dates", async ({
  page,
}) => {
  await page.goto("/meetings/");
  const intro = page.locator(".prose").first();
  const upcoming = page.locator("#upcoming-title");
  await expect(intro).toContainText("perfectly good reason");
  const introBox = (await intro.boundingBox())!;
  const upcomingBox = (await upcoming.boundingBox())!;
  expect(introBox.y).toBeLessThan(upcomingBox.y);
});

test("the trash page names the county recycling schedule once", async ({
  page,
}) => {
  await page.goto("/rules/trash-recycling/");
  const links = page.locator(`a[href="${countyRecyclingUrl}"]`);
  await expect(links).toHaveCount(1);
});

test("the calendar feed is valid iCalendar", async ({ request }) => {
  const res = await request.get("/calendar.ics");
  expect(res.ok()).toBe(true);
  const body = await res.text();
  expect(body.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
  expect(body.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
  // One name for a board meeting everywhere: the feed, the meetings page and
  // the meeting's own page all read it from MEETING_LABEL.
  expect(body).toContain("SUMMARY:Board meeting");
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

test("on a phone the glance band comes before the map; on a desktop the map sits beside the title", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const glance = (await page.locator(".glance").boundingBox())!;
  const map = (await page.locator(".hero__map").boundingBox())!;
  expect(glance.y, "the glance band is below the map on a phone").toBeLessThan(
    map.y,
  );
  expect(glance.y, "the glance band is not on the first screen").toBeLessThan(
    844,
  );

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  const title = (await page.getByRole("heading", { level: 1 }).boundingBox())!;
  const wideMap = (await page.locator(".hero__map").boundingBox())!;
  expect(Math.abs(wideMap.y - title.y)).toBeLessThan(200);
});

test("the home page uses one word for the money residents owe", async ({
  page,
}) => {
  await page.goto("/");
  const text = await page.locator("main, .site-header").allInnerTexts();
  expect(text.join(" ")).not.toMatch(/assessment/i);
  await expect(
    page.getByRole("link", { name: "Pay dues" }).first(),
  ).toBeVisible();
});

test("the header is the same height whether the web font or the fallback font draws the page", async ({
  browser,
}) => {
  // Fonts use font-display: swap, so either can be drawing when this runs.
  // The header's layout must not depend on which one did.
  for (const width of [390, 1024, 1366]) {
    const heights: number[] = [];
    for (const blockFonts of [false, true]) {
      const context = await browser.newContext({
        viewport: { width, height: 800 },
      });
      const page = await context.newPage();
      if (blockFonts) await page.route(/\.woff2$/, (route) => route.abort());
      await page.goto("/");
      heights.push(
        await page
          .locator(".site-header")
          .evaluate((el) => Math.round(el.getBoundingClientRect().height)),
      );
      await context.close();
    }
    expect(heights[1], `header height at ${width}px`).toBe(heights[0]);
  }
});
