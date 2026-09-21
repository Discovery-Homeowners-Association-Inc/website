import AxeBuilder from "@axe-core/playwright";
import {
  type APIRequestContext,
  type Browser,
  expect,
  type Page,
} from "@playwright/test";

/** The one administrator every spec bootstraps; only the first bootstrap succeeds, the rest answer 409. */
export const ADMIN = "secretary@example.com";
export const BOOTSTRAP_TOKEN = "e2e-bootstrap-token-for-tests-only-0123456789";

export async function bootstrap(request: APIRequestContext) {
  const res = await request.post("/api/bootstrap", {
    headers: { authorization: `Bearer ${BOOTSTRAP_TOKEN}` },
    data: { email: ADMIN, name: "Sam Secretary" },
  });
  expect([201, 409]).toContain(res.status());
}

/** Signs in through the developer endpoint, which exists only on local http servers. */
export async function signIn(browser: Browser, email: string, phone = false) {
  const page = await (
    await browser.newContext(
      phone
        ? {
            viewport: { width: 390, height: 844 },
            hasTouch: true,
            isMobile: true,
          }
        : {},
    )
  ).newPage();
  await page.goto("/sign-in/");
  await page.getByLabel("Invited email").fill(email);
  await page.getByRole("button", { name: "Sign in without Google" }).click();
  await expect(page.getByRole("heading", { name: /^Hello/ })).toBeVisible();
  return page;
}

export async function expectAccessible(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    violations.map(
      (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
    ),
  ).toEqual([]);
}

export const noSidewaysScroll = async (page: Page) =>
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(0);
