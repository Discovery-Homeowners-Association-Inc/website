import { expect, type Page } from "@playwright/test";

/** Widths that matter: phones, tablets, laptops, and both sides of each breakpoint. */
export const LADDER = [
  320, 360, 390, 414, 480, 600, 640, 700, 703, 704, 768, 834, 900, 1000, 1024,
  1100, 1135, 1136, 1152, 1200, 1280, 1366, 1440, 1600, 1920,
];

/** The height a header may take at a given width. See packages/design/README.md. */
export const heightBudget = (width: number) =>
  width >= 1136 ? 80 : width >= 704 ? 150 : 72;

/**
 * Every navigation link must lie inside its container. The old header put the
 * links in an end-justified nowrap flex container with a hidden scrollbar,
 * where overflow is unreachable — `scrollWidth === clientWidth` — so a link was
 * deleted outright rather than clipped. This is the assertion that catches it.
 */
/**
 * Where the header folds its links behind a button: 44rem, in pixels.
 *
 * The same number as the phone band in packages/design/base.css. A test that
 * clicks the toggle "if it is there" cannot tell a working header from a
 * broken one, so the tests say which side of this they expect to be on.
 */
export const PHONE_BAND_PX = 704;

/**
 * How many navigation links are actually on screen, and a refusal to continue
 * if the answer is none.
 *
 * Every check below filters to links with a width, so a panel that failed to
 * open leaves each of them looking at an empty list and passing. Nine of the
 * twenty-five widths on the ladder were doing exactly that, asserting nothing
 * but the header's height. An empty list is now a failure, not a pass.
 */
export async function expectLinksToCheck(page: Page, nav = ".site-nav") {
  const count = await page.evaluate(
    (sel) =>
      [...document.querySelectorAll(`${sel} a`)].filter(
        (a) => a.getBoundingClientRect().width > 0,
      ).length,
    nav,
  );
  expect(
    count,
    `no visible links in ${nav}: every check here would pass without looking at anything`,
  ).toBeGreaterThan(0);
  return count;
}

export async function expectNoClippedLinks(page: Page, nav = ".site-nav") {
  await expectLinksToCheck(page, nav);
  const clipped = await page.evaluate((sel) => {
    const list = document.querySelector(`${sel} ul`);
    if (!list) return ["no nav list found"];
    const box = list.getBoundingClientRect();
    return [...document.querySelectorAll(`${sel} a`)]
      .filter((a) => a.getBoundingClientRect().width > 0)
      .filter((a) => {
        const r = a.getBoundingClientRect();
        return r.left < box.left - 0.5 || r.right > box.right + 0.5;
      })
      .map((a) => a.textContent?.trim() ?? "");
  }, nav);
  expect(clipped, "navigation links cut off by their container").toEqual([]);
}

export async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow, "the page scrolls sideways").toBeLessThanOrEqual(0);
}

export async function expectHeaderHeightAtMost(
  page: Page,
  px: number,
  header = ".site-header",
) {
  const height = await page.evaluate(
    (sel) =>
      Math.round(document.querySelector(sel)!.getBoundingClientRect().height),
    header,
  );
  expect(height, "header height").toBeLessThanOrEqual(px);
}

/** WCAG 2.2 2.5.8: a pointer target is at least 24 by 24 CSS pixels. */
export async function expectTargetSize(page: Page, nav = ".site-nav") {
  await expectLinksToCheck(page, nav);
  const small = await page.evaluate((sel) => {
    return [...document.querySelectorAll(`${sel} a`)]
      .map((a) => ({
        text: a.textContent?.trim() ?? "",
        r: a.getBoundingClientRect(),
      }))
      .filter(({ r }) => r.width > 0)
      .filter(({ r }) => r.width < 24 || r.height < 24)
      .map(
        ({ text, r }) =>
          `${text} ${Math.round(r.width)}x${Math.round(r.height)}`,
      );
  }, nav);
  expect(small, "navigation targets smaller than 24x24").toEqual([]);
}

/** WCAG 2.2 2.4.11: a focused link is not hidden by anything, its container included. */
export async function expectFocusVisible(page: Page, nav = ".site-nav") {
  await expectLinksToCheck(page, nav);
  const hidden = await page.evaluate((sel) => {
    const out: string[] = [];
    for (const a of document.querySelectorAll<HTMLElement>(`${sel} a`)) {
      if (a.getBoundingClientRect().width === 0) continue;
      a.focus();
      const r = a.getBoundingClientRect();
      const inViewport =
        r.left >= -0.5 &&
        r.top >= -0.5 &&
        r.right <= window.innerWidth + 0.5 &&
        r.bottom <= window.innerHeight + 0.5;
      if (!inViewport) out.push(a.textContent?.trim() ?? "");
    }
    return out;
  }, nav);
  expect(hidden, "focused links outside the viewport").toEqual([]);
}
