import { expect, type Page, test } from "@playwright/test";
import { ADMIN, bootstrap, signIn } from "./helpers.ts";

/**
 * The admin screens are the same design system as the public site, so a select,
 * a date field and a text box standing in one row have to agree on their size.
 * They did not: the meeting form measured 46, 51, 49 and 49 pixels tall at four
 * different heights, and the role checkboxes drew at the browser's own 13px,
 * under the 24px WCAG 2.2 target minimum.
 */
test.describe.configure({ mode: "serial" });

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
  await bootstrap(request);
});

test("text, date and select controls are all the same height", async ({
  browser,
}) => {
  const page = await signIn(browser, ADMIN);
  for (const path of ["/meetings/", "/people/", "/roster/"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    // The roster shows a list until an editor is opened, so open one. This is
    // the screen the skip-when-empty was quietly passing over.
    if (path === "/roster/")
      await page.getByRole("button", { name: "Edit" }).first().click();
    const controls = await controlHeights(page);
    // Every one of these screens has a form on it. Skipping when none is found
    // -- which is what this did -- reports green after asserting nothing, and
    // a hydration error or a 500 is exactly what makes the form disappear. The
    // next test in this file already guards against that shape.
    expect(
      controls.length,
      `no form controls on ${path}: this test would pass without looking at anything`,
    ).toBeGreaterThan(0);
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

test("a list field's open rows keep their own state through remove and move", async ({
  browser,
}) => {
  const page = await signIn(browser, ADMIN);
  await page.goto("/settings/?group=pool");
  await page.waitForLoadState("networkidle");
  // The pool's hours: four rows, so none start open (only three or fewer do).
  const fieldset = page.locator(
    'fieldset.list-field:has(legend:text-is("Hours"))',
  );
  const rows = fieldset.locator(":scope > details.list-item");
  await expect(rows).toHaveCount(4);

  // Open the first two rows; the third and fourth stay collapsed. A row's
  // own Remove/Move buttons live inside its <details>, which the browser
  // hides while collapsed, so a row must be open to act on itself.
  await rows.nth(0).locator("summary").click();
  await rows.nth(1).locator("summary").click();
  await expect(rows.nth(0)).toHaveJSProperty("open", true);
  await expect(rows.nth(1)).toHaveJSProperty("open", true);

  // Remove the (open) first row. The row that is now first (the old second
  // row) must keep the open state it had, not whatever the old first row's
  // state was; the row that is now last (the old fourth, never touched)
  // must still be collapsed, not inherit an old neighbor's open state.
  page.once("dialog", (d) => void d.accept());
  await rows.nth(0).getByRole("button", { name: "Remove" }).click();
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toHaveJSProperty("open", true);
  await expect(rows.nth(2)).toHaveJSProperty("open", false);

  // Move the still-collapsed middle row (the old third) up past the open
  // row above it. A collapsed row's own action buttons sit inside its
  // <details>, which the browser removes from layout and the accessibility
  // tree while closed -- opening the row first to reach its button would
  // flip the very state under test, and a forced pointer click would hit
  // whatever real element sits at the (collapsed) button's coordinates
  // instead -- so this dispatches the click event on the button node
  // directly. It must arrive at the top still collapsed, not take on the
  // open state of the row it displaced.
  await rows
    .nth(1)
    .locator(".actions button.button--quiet")
    .first()
    .dispatchEvent("click");
  await expect(rows.nth(0)).toHaveJSProperty("open", false);
});
