import { expect, test } from "@playwright/test";

/**
 * The parks map is a picture with markers laid over it, positioned as a
 * percentage of the picture's box. That only works while the percentages and
 * the picture's viewBox agree, and nothing in the page itself would complain
 * if they stopped agreeing -- the markers would quietly drift off the
 * neighborhood, or off the picture entirely. So these check where they land,
 * and that picking one says which park it is.
 */
test.beforeEach(async ({ page }) => {
  await page.goto("/amenities/parks/");
  await expect(page.locator(".parkmap")).toBeVisible();
});

test("draws a marker for every place in the list", async ({ page }) => {
  const entries = await page.locator(".parkmap__entry").count();
  expect(entries).toBeGreaterThan(20);
  await expect(page.locator(".parkmap__mark")).toHaveCount(entries);
});

test("numbers the parks 1 to 20, in order", async ({ page }) => {
  const numbers = await page.locator(".parkmap__mark--park").allInnerTexts();
  expect(numbers.map((t) => Number(t.trim()))).toEqual(
    Array.from({ length: 20 }, (_, i) => i + 1),
  );
});

test("no two markers touch, and their centers stay a target apart", async ({
  page,
}) => {
  /*
   * WCAG 2.2 target size, by the spacing exception: a marker may be under 24px
   * as long as a 24px circle centered on it does not reach another. The easing
   * in the component is what guarantees that, and it is expressed in the
   * picture's units -- so the width to check is the narrowest the site
   * supports, where the picture is smallest and the gap tightest.
   */
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/amenities/parks/");
    const marks = await page.evaluate(() =>
      [...document.querySelectorAll(".parkmap__mark")].map((el) => {
        const r = el.getBoundingClientRect();
        return {
          label: el.getAttribute("aria-label") ?? "",
          x: r.x + r.width / 2,
          y: r.y + r.height / 2,
          w: r.width,
        };
      }),
    );
    expect(marks.length).toBeGreaterThan(20);
    for (let a = 0; a < marks.length; a++)
      for (let b = a + 1; b < marks.length; b++) {
        const first = marks[a]!;
        const second = marks[b]!;
        const gap = Math.hypot(first.x - second.x, first.y - second.y);
        expect(
          gap,
          `at ${width}px, ${first.label} and ${second.label} are ${gap.toFixed(1)}px apart`,
        ).toBeGreaterThanOrEqual(24);
        expect(
          gap,
          `at ${width}px, ${first.label} overlaps ${second.label}`,
        ).toBeGreaterThanOrEqual(first.w / 2 + second.w / 2);
      }
  }
});

test("keeps every marker on the map", async ({ page }) => {
  const picture = await page.locator(".parkmap__picture").boundingBox();
  expect(picture).not.toBeNull();
  const marks = page.locator(".parkmap__mark");
  for (let i = 0; i < (await marks.count()); i++) {
    const box = await marks.nth(i).boundingBox();
    const label = await marks.nth(i).getAttribute("aria-label");
    expect(box, `${label} has no box`).not.toBeNull();
    // Centers, so a marker half over the edge still counts as on the map.
    const x = box!.x + box!.width / 2;
    const y = box!.y + box!.height / 2;
    expect(x, `${label} is off the left of the map`).toBeGreaterThan(
      picture!.x,
    );
    expect(x, `${label} is off the right of the map`).toBeLessThan(
      picture!.x + picture!.width,
    );
    expect(y, `${label} is off the top of the map`).toBeGreaterThan(picture!.y);
    expect(y, `${label} is off the bottom of the map`).toBeLessThan(
      picture!.y + picture!.height,
    );
  }
});

test("says which park it is when you pick a marker", async ({ page }) => {
  const detail = page.locator(".parkmap__detail");
  await expect(detail).toContainText("Pick a marker");

  const mark = page.locator('.parkmap__mark[data-label="Park 12"]');
  await mark.click();
  await expect(detail).toContainText("Park 12");
  await expect(detail).toContainText("Off Treasure Avenue");
  // What is there is the point of picking one, so check it arrives too.
  await expect(detail).toContainText("Swing set (3 seats), slide");
  await expect(mark).toHaveClass(/is-lit/);

  // Picking the same one again lets go of it.
  await mark.click();
  await expect(detail).toContainText("Pick a marker");
});

test("says what is at every park, not just where it is", async ({ page }) => {
  const parks = page.locator(".parkmap__mark--park");
  for (let i = 0; i < (await parks.count()); i++) {
    const mark = parks.nth(i);
    const label = await mark.getAttribute("data-label");
    expect(
      await mark.getAttribute("data-where"),
      `${label} has no street`,
    ).toMatch(/^Off /);
    expect(
      (await mark.getAttribute("data-what")) ?? "",
      `${label} has no description`,
    ).not.toBe("");
  }
});

test("names a marker when it is reached by keyboard", async ({ page }) => {
  await page.locator('.parkmap__mark[data-label="Park 1"]').focus();
  await expect(page.locator(".parkmap__detail")).toContainText("Park 1");
});

test("every marker links to its own entry, for when scripts do not run", async ({
  page,
}) => {
  const marks = page.locator(".parkmap__mark");
  for (let i = 0; i < (await marks.count()); i++) {
    const href = await marks.nth(i).getAttribute("href");
    expect(href, "a marker with no link").toMatch(/^#place-\d+$/);
    await expect(page.locator(href!)).toHaveCount(1);
  }
});

test("folds the full list away, and opens it on request", async ({ page }) => {
  const list = page.locator(".parkmap__all");
  await expect(list).not.toHaveAttribute("open", /.*/);
  await list.locator("summary").click();
  await expect(list).toHaveAttribute("open", /.*/);
  await expect(page.locator(".parkmap__entry").first()).toBeVisible();
});
