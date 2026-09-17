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
    const toggle = page.locator(".nav-toggle");
    if (await toggle.isVisible()) await toggle.click();
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

test("an administrator's seven links fit every width", async ({ browser }) => {
  const page = await signIn(browser, ADMIN);
  await expect(
    page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Settings", exact: true }),
  ).toBeVisible();
  await walkTheLadder(page);
});

test("the header itself has no accessibility violations", async ({
  browser,
}) => {
  const page = await signIn(browser, ADMIN);
  for (const width of [390, 900, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const toggle = page.locator(".nav-toggle");
    if (await toggle.isVisible()) await toggle.click();
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
