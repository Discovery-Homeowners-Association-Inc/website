import { expect, test } from "@playwright/test";

/**
 * Printing, from a dark screen.
 *
 * DESIGN.md says every page prints cleanly, and nothing checked it. Both apps'
 * print blocks set the body's own background and color, which is not enough:
 * every panel, rule and callout reads the palette tokens, and in dark mode
 * those were still dark when the page reached paper.
 */
const brightness = (color: string) => {
  const [r, g, b] = (color.match(/\d+/g) ?? ["0", "0", "0"]).map(Number) as [
    number,
    number,
    number,
  ];
  return (r + g + b) / 3;
};

for (const scheme of ["light", "dark"] as const) {
  test(`pages print on light paper from a ${scheme} screen`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: scheme, media: "print" });
    await page.goto("/meetings/");

    const seen = await page.evaluate(() => {
      const read = (sel: string) => {
        const el = document.querySelector(sel);
        return el ? getComputedStyle(el).backgroundColor : null;
      };
      return {
        body: getComputedStyle(document.body).backgroundColor,
        ink: getComputedStyle(document.body).color,
        panel: read(".panel"),
      };
    });

    expect(
      brightness(seen.body),
      "the page prints on a dark ground",
    ).toBeGreaterThan(200);
    expect(brightness(seen.ink), "the text prints light on light").toBeLessThan(
      120,
    );
    if (seen.panel && !seen.panel.includes("rgba(0, 0, 0, 0)"))
      expect(
        brightness(seen.panel),
        "a panel prints as a dark block",
      ).toBeGreaterThan(200);
  });
}
