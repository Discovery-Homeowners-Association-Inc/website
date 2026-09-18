import { expect, test } from "@playwright/test";

/**
 * The parks map is a picture with markers laid over it, positioned as a
 * percentage of the picture's box. That only works while the percentages and
 * the picture's viewBox agree, and nothing in the page itself would complain
 * if they stopped agreeing -- the markers would quietly drift off the
 * neighborhood, or off the picture entirely. So these check where they land.
 */
test.beforeEach(async ({ page }) => {
  await page.goto("/amenities/parks/");
  await expect(page.locator(".parkmap")).toBeVisible();
});

test("draws a marker for every place in the key", async ({ page }) => {
  const rows = await page.locator(".parkmap__list li").count();
  expect(rows).toBeGreaterThan(20);
  await expect(page.locator(".parkmap__mark")).toHaveCount(rows);
});

test("numbers the parks 1 to 20, in order", async ({ page }) => {
  const numbers = await page
    .locator(".parkmap__list:not(.parkmap__list--amenities) li b")
    .allInnerTexts();
  expect(numbers.map(Number)).toEqual(
    Array.from({ length: 20 }, (_, i) => i + 1),
  );
});

test("keeps every marker on the map", async ({ page }) => {
  const picture = await page.locator(".parkmap__picture").boundingBox();
  expect(picture).not.toBeNull();
  const marks = page.locator(".parkmap__mark");
  for (let i = 0; i < (await marks.count()); i++) {
    const box = await marks.nth(i).boundingBox();
    const label = await marks.nth(i).getAttribute("title");
    expect(box, `${label} has no box`).not.toBeNull();
    // Centres, so a marker half over the edge still counts as on the map.
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

test("lights a park on the map when you point at it in the key", async ({
  page,
}) => {
  const row = page.locator(".parkmap__list li").first();
  const id = await row.getAttribute("data-place");
  const mark = page.locator(`.parkmap__mark[data-place="${id}"]`);
  await expect(mark).not.toHaveClass(/is-lit/);
  await row.hover();
  await expect(mark).toHaveClass(/is-lit/);
});
