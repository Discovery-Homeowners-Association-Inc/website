import { expect, test } from "@playwright/test";
import {
  expectFocusVisible,
  expectHeaderHeightAtMost,
  expectNoClippedLinks,
  expectNoSidewaysScroll,
  expectTargetSize,
  heightBudget,
  LADDER,
} from "../../../packages/design/test/header-checks";

/**
 * The header, across every width that matters, in the web font and in the
 * fallback font. `font-display: optional` means a first visit can legitimately
 * be drawn in the fallback, which is wider — so the fallback is the case the
 * layout has to survive, not an edge case.
 */
for (const font of ["web font", "fallback font"] as const) {
  test.describe(font, () => {
    test.beforeEach(async ({ context }) => {
      if (font === "fallback font")
        await context.route("**/*.woff2", (route) => route.abort());
    });

    for (const width of LADDER) {
      test(`no link is cut off at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto("/");
        await expectHeaderHeightAtMost(page, heightBudget(width));
        const toggle = page.locator(".nav-toggle");
        if (await toggle.isVisible()) await toggle.click();
        await expectNoClippedLinks(page);
        await expectNoSidewaysScroll(page);
        await expectTargetSize(page);
        await expectFocusVisible(page);
      });
    }
  });
}

test("every navigation link is reachable at the widest layout", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 900 });
  await page.goto("/");
  for (const label of [
    "Meetings",
    "Amenities",
    "Rules & requests",
    "Documents",
    "News & events",
    "Contact",
  ]) {
    await expect(
      page.getByRole("navigation", { name: "Main" }).getByRole("link", {
        name: label,
        exact: true,
      }),
    ).toBeVisible();
  }
});

test("the phone panel overlays the page instead of pushing it down", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const heading = page.getByRole("heading", { level: 1 });
  const before = (await heading.boundingBox())!.y;
  await page.locator(".nav-toggle").click();
  await expect(
    page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Meetings", exact: true }),
  ).toBeVisible();
  const after = (await heading.boundingBox())!.y;
  expect(after, "opening the menu moved the page").toBe(before);
});

test("Escape closes the menu and returns focus to the button", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const toggle = page.locator(".nav-toggle");
  await toggle.click();
  await expect(toggle).toHaveText("Close");
  await page.keyboard.press("Escape");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toHaveText("Menu");
  await expect(toggle).toBeFocused();
});

test("a click outside closes the menu", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const toggle = page.locator(".nav-toggle");
  await toggle.click();
  // Well below the open panel, which legitimately covers the top of the page.
  await page.mouse.click(60, 820);
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("every navigation link is still reachable on a phone", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Main" });
    for (const label of ["Meetings", "Amenities", "Contact"]) {
      await expect(
        nav.getByRole("link", { name: label, exact: true }),
      ).toBeVisible();
    }
    await expect(page.getByRole("link", { name: "Pay dues" })).toBeVisible();
  });
});

test("the header stays in view while the page scrolls", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  await page.goto("/documents/");
  await page.evaluate(() => window.scrollTo(0, 1200));
  const box = (await page.locator(".site-header").boundingBox())!;
  expect(Math.round(box.y), "header top after scrolling").toBe(0);
});

test("an anchored heading is not hidden under the header", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  await page.goto("/documents/#main");
  const headerBottom = (await page.locator(".site-header").boundingBox())!;
  const main = (await page.locator("#main").boundingBox())!;
  expect(
    main.y,
    "the anchor target sits under the sticky header",
  ).toBeGreaterThanOrEqual(headerBottom.y + headerBottom.height - 0.5);
});
