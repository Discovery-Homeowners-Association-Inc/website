import { type Browser, expect, type Page, test } from "@playwright/test";

/**
 * The admin screens are the same design system as the public site, so a select,
 * a date field and a text box standing in one row have to agree on their size.
 * They did not: the meeting form measured 46, 51, 49 and 49 pixels tall at four
 * different heights, and the role checkboxes drew at the browser's own 13px,
 * under the 24px WCAG 2.2 target minimum.
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

/** Heights of the controls that are meant to look alike, keyed by what they are. */
async function controlHeights(page: Page) {
  return page.evaluate(() => {
    const sel =
      'input[type="text"], input[type="email"], input[type="date"], input[type="number"], select';
    return [...document.querySelectorAll<HTMLElement>(sel)]
      .filter((el) => el.getBoundingClientRect().width > 0)
      .map((el) => ({
        what: `${el.tagName.toLowerCase()}${el.getAttribute("type") ? `[${el.getAttribute("type")}]` : ""}`,
        height: Math.round(el.getBoundingClientRect().height),
      }));
  });
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

test("text, date and select controls are all the same height", async ({
  browser,
}) => {
  const page = await signIn(browser, ADMIN);
  for (const path of ["/meetings/", "/people/", "/roster/"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const controls = await controlHeights(page);
    if (controls.length === 0) continue; // an index screen with no form
    const heights = [...new Set(controls.map((c) => c.height))];
    expect(
      heights,
      `${path} draws its controls at more than one height: ${controls
        .map((c) => `${c.what}=${c.height}`)
        .join(", ")}`,
    ).toHaveLength(1);
  }
});

test("checkboxes meet the 24px target minimum", async ({ browser }) => {
  const page = await signIn(browser, ADMIN);
  await page.goto("/people/");
  await page.waitForLoadState("networkidle");
  const boxes = await page.evaluate(() =>
    [...document.querySelectorAll('input[type="checkbox"]')]
      .filter((el) => el.getBoundingClientRect().width > 0)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height) };
      }),
  );
  // An empty list would pass every assertion below without testing anything.
  expect(
    boxes.length,
    "no checkboxes found on the accounts screen",
  ).toBeGreaterThan(0);
  const tooSmall = boxes.filter((b) => b.w < 24 || b.h < 24);
  expect(tooSmall, "checkboxes under the 24px WCAG target size").toEqual([]);
});
