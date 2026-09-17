import { expect, test } from "@playwright/test";
import {
  expectFocusVisible,
  expectNoClippedLinks,
  expectNoSidewaysScroll,
  expectTargetSize,
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
        const toggle = page.getByRole("button", { name: "Menu" });
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
