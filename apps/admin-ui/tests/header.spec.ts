import AxeBuilder from "@axe-core/playwright";
import { type Browser, expect, type Page, test } from "@playwright/test";
import {
  expectFocusVisible,
  expectHeaderHeightAtMost,
  expectNoClippedLinks,
  expectNoSidewaysScroll,
  expectTargetSize,
  heightBudget,
  LADDER,
  PHONE_BAND_PX,
} from "../../../packages/design/test/header-checks";

/**
 * The shared header, carrying admin's links: seven for an administrator, five
 * for everyone else. The same assertions the public site's ladder makes, so the
 * two apps cannot drift apart again without a failure.
 */
test.describe.configure({ mode: "serial" });

// The same first administrator the other suites bootstrap into the shared
// throwaway database; only the first bootstrap succeeds, the rest answer 409.
const ADMIN = "secretary@example.com";

async function signIn(browser: Browser, email: string) {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/sign-in/");
  await page.getByLabel("Invited email").fill(email);
  await page.getByRole("button", { name: "Sign in without Google" }).click();
  await expect(page.getByRole("heading", { name: /^Hello/ })).toBeVisible();
  return page;
}

async function walkTheLadder(page: Page) {
  for (const width of LADDER) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expectHeaderHeightAtMost(page, heightBudget(width));
    /*
     * Which side of the phone breakpoint we are on is itself the
     * assertion. Clicking the toggle only when it happened to be visible
     * meant a toggle that stopped rendering left the panel closed and
     * every check below with nothing to look at -- and passing.
     */
    const toggle = page.locator(".nav-toggle");
    if (width < PHONE_BAND_PX) {
      await expect(toggle).toBeVisible();
      await toggle.click();
    } else {
      await expect(toggle).toBeHidden();
    }
    await expectNoClippedLinks(page);
    await expectNoSidewaysScroll(page);
    await expectTargetSize(page);
    await expectFocusVisible(page);
  }
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

test("every link an administrator has fits at every width", async ({
  browser,
}) => {
  const page = await signIn(browser, ADMIN);
  const nav = page.getByRole("navigation", { name: "Main" });
  // Named rather than counted, and the last two named on purpose: a link
  // added to the end is the one the header runs out of room for first.
  for (const name of ["Settings", "Export", "Help"])
    await expect(nav.getByRole("link", { name, exact: true })).toBeVisible();
  await walkTheLadder(page);
});

test("the header itself has no accessibility violations", async ({
  browser,
}) => {
  const page = await signIn(browser, ADMIN);
  for (const width of [390, 900, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    /*
     * Which side of the phone breakpoint we are on is itself the
     * assertion. Clicking the toggle only when it happened to be visible
     * meant a toggle that stopped rendering left the panel closed and
     * every check below with nothing to look at -- and passing.
     */
    const toggle = page.locator(".nav-toggle");
    if (width < PHONE_BAND_PX) {
      await expect(toggle).toBeVisible();
      await toggle.click();
    } else {
      await expect(toggle).toBeHidden();
    }
    const { violations } = await new AxeBuilder({ page })
      .include(".site-header")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      violations.map(
        (v) =>
          `${width}px ${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
      ),
    ).toEqual([]);
  }
});

test("the static pages carry the same security headers as the API", async ({
  request,
}) => {
  const res = await request.get("/sign-in/");
  expect(res.headers()["x-frame-options"]).toBe("DENY");
  expect(res.headers()["x-content-type-options"]).toBe("nosniff");
});
