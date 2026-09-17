# The site header: design

Goal: one header, shared by the public site and the admin app, that fits every screen from a
320px phone to a 4K desktop, in the web font or the fallback font, and that can never again hide
a navigation link without a test failing.

## The defect

The header's one-row layout switches on at `72rem` (1152px). The content does not fit at 1152px.

Measured on the built site, at the widest `.wrap` (`--page: 76rem`), with each header area taking
its natural size:

| Piece                    | Web font   | Fallback font |
| ------------------------ | ---------- | ------------- |
| Gutters (`--gutter` × 2) | 80px       | 80px          |
| Brand (mark + two lines) | 273px      | 276px         |
| Column gap × 2           | 48px       | 48px          |
| Six nav links            | 688px      | 727px         |
| "Pay dues"               | 116px      | 119px         |
| **Minimum for one row**  | **1205px** | **1250px**    |

So the breakpoint is 53px too small in the web font and 98px too small in the fallback font.

That shortfall became _invisible_ rather than merely ugly because `.site-nav ul` combines
`flex-wrap: nowrap`, `overflow-x: auto`, `scrollbar-width: none` and (at `72rem`)
`justify-content: flex-end`. End-justified flex overflow is unreachable: the browser reports
`scrollWidth === clientWidth`, so the hidden part cannot be scrolled to by any means. The link is
not clipped-but-reachable. It is gone.

Observed consequences, all reproduced in Chromium on the built site:

- **Web font:** "Meetings" is cut in half from 1152px to 1175px.
- **Fallback font:** "Meetings" is cut at _every_ width from 1152px upward — 11px at 1280px,
  22px at 1440px, 41px at 1920px and every width beyond, permanently, because `.wrap` stops
  growing at `76rem`. This is the case `base.css` claims in a comment to have designed for.
- A cut link cannot be scrolled into view, so its focus ring is cut too (WCAG 2.2 2.4.11,
  focus not obscured).
- Header height swings 81px → 137px → 141px across the width ladder. On a 390px phone it is
  141px in three rows before anything is opened, and 416px with the menu open, because the panel
  pushes the page down instead of overlaying it.
- With JavaScript disabled, `.site-nav` is `display: none` with nothing able to reveal it: a
  phone visitor gets **no navigation at all**.
- Escape does not close the menu, and the button reads "Menu" whether it is open or closed.
- The admin app has a second, unrelated header: no menu button, a `repeat(auto-fill, minmax(6rem,
1fr))` grid of links, and its own `64rem`/`52rem` breakpoints. Its header is 217px tall on a
  390px phone, 238px at 360px and 286px at 320px.

The reason this shipped is that the only test touching the header asserts that its **height** is
the same in both fonts. Nothing asserts that the links are visible. Height parity held while the
links were being deleted.

## Decisions

### 1. One shared component

`packages/design/SiteHeader.astro`, exported as `@dhoa/design/SiteHeader.astro`. The design
package currently ships only CSS, the mark and the fonts; adding one `.astro` export is a
two-line `exports` change, and both consumers are Astro apps.

Props:

| Prop        | Meaning                                                                 |
| ----------- | ----------------------------------------------------------------------- |
| `title`     | "Discovery Homeowners" / "Discovery HOA"                                |
| `subtitle`  | "Walkersville, Maryland" / "Board administration"                       |
| `nav`       | `{ href, label, adminOnly? }[]`                                         |
| `path`      | `Astro.url.pathname`, for `aria-current`                                |
| `exactRoot` | `true` in admin, where `/` must match exactly and not prefix every page |

A `<slot name="action">` carries the only real difference between the two headers: "Pay dues" on
the site, "You / Sign out" in admin. `adminOnly` items keep the existing `data-admin-only`
attribute so the pre-paint role check in `Admin.astro` is unchanged.

`Base.astro` and `Admin.astro` drop their own nav markup and toggle script. The divergent header
block in `apps/admin-ui/src/styles/admin.css` is deleted; the two genuinely admin-specific rules
(a smaller mark, tighter sign-out button) move into the component's own sizing.

### 2. Sizing: shrink to fit, and set the breakpoint from the measurement

Nav text goes from 18px to **16px**; the brand from 1.15rem to 1.05rem; the mark from 2.75rem to
2.4rem; the inter-link gap to `1rem`; the action button's padding to `0.55rem 0.9rem`. Measured
minimum for one row after that: **1090px** (web font), **1120px** (fallback font).

**One-row breakpoint: `71rem` (1136px)** — 16px of headroom in the worst case.

15px nav text was considered and rejected: it would allow `66rem`, but `docs/DESIGN.md` chooses
Atkinson Hyperlegible Next because "many residents are older", and shrinking the navigation is
the one reduction that costs those readers something real.

The admin header has seven shorter links. Its one-row breakpoint is set the same way — from a
measurement taken during implementation, not from a round number.

### 3. Wrapping, not clipping — a floor under the breakpoint

`overflow-x: auto` + `scrollbar-width: none` → **`flex-wrap: wrap`**, and
`justify-content: flex-end` → `margin-inline-start: auto` on the list, so end-alignment can never
produce unreachable overflow again.

At `71rem` the links fit, so wrapping never fires in normal use. If a label is renamed, a visitor
sets a larger minimum font size, or a translation lands, the row gains a second line instead of
amputating a link. This does not replace the sizing decision; it removes the failure class that
the sizing decision would otherwise still be one rename away from.

### 4. Three bands, each from a measurement

| Band               | Layout                                   | Height now                       | Budget (asserted) |
| ------------------ | ---------------------------------------- | -------------------------------- | ----------------- |
| ≥ `71rem` (1136px) | brand · links · action, one row          | 81px                             | ≤ 80px            |
| `40rem`–`71rem`    | brand · action / links on their own line | 137px                            | ≤ 150px           |
| < `40rem` (640px)  | brand · Menu, one row (panel closed)     | 141px site, 217px admin at 390px | ≤ 72px            |

The budgets are the numbers the tests assert, not aspirations. In the middle band the links sit
on one line from about 682px up — below that, down to 640px, they take two lines and the header
approaches the 150px budget. That is the wrapping rule in §3 doing its job, and it is why the
middle band's budget is not tighter.

On a phone the header becomes one row. "Pay dues", and admin's "You / Sign out", move inside the
open panel rather than occupying a row of their own beside the Menu button. The panel is
`position: absolute` under the header, so opening it no longer pushes the page down 275px.

The header becomes `position: sticky; top: 0` with a `z-index` above page content and a bottom
rule, so the navigation stays reachable on long pages. `--header-z` is added as a token so the
admin app's notices and dialogs can sit above it deliberately.

### 5. The menu works without JavaScript

The panel is visible by default. An inline script in `<head>` sets `data-js` on `<html>` before
first paint; the CSS hides the panel only under `html[data-js]`. So:

- **No JavaScript:** the links render, stacked under the brand on a phone. Taller than the
  collapsed header, and completely usable — which is the point.
- **JavaScript:** the panel starts hidden with no flash, and the button controls it.

The enhancement script then adds what is missing today: Escape closes the panel, a click outside
closes it, focus returns to the button on close, and the label swaps between "Menu" and "Close"
alongside `aria-expanded`.

`<details>`/`<summary>` was considered and rejected. Chrome 131+ hides closed content with
`::details-content { content-visibility: hidden }`, so forcing the panel open at desktop widths
needs a different override per browser generation — fragile in exactly the place this design is
trying to make boring.

### 6. The tests that would have caught this

A shared helper plus a header spec in each app (`apps/site/tests/header.spec.ts`,
`apps/admin-ui/tests/header.spec.ts`), run over a width ladder — 320, 360, 390, 414, 480, 600,
639, 640, 700, 768, 834, 900, 1000, 1024, 1100, 1135, 1136, 1200, 1280, 1366, 1440, 1600, 1920 —
crossed with {web font, `**/*.woff2` aborted} and, in admin, {administrator, non-administrator}:

1. **No nav link is clipped**: every link's box lies inside its container's box. This assertion
   fails today at every width from 1152px up in the fallback font.
2. `document.documentElement.scrollWidth === clientWidth`: the page never scrolls sideways.
3. Header height is within the band's budget.
4. Every nav link is at least 24×24 CSS px (WCAG 2.2 2.5.8).
5. A focused link is entirely inside the viewport (WCAG 2.2 2.4.11).
6. With JavaScript disabled at 390px, every nav link is reachable.
7. `@axe-core/playwright` finds no violation in the header. It is already a dependency of
   `apps/site` and currently unused.

The existing font-parity height test in `apps/site/tests/site.spec.ts` stays. The existing "the
menu button opens the navigation on a phone" test is updated for the new markup.

### 7. Housekeeping carried by this change

- `apps/site/real2.tmp.mjs`, a stray from an earlier session, is deleted.
- The uncommitted edits to `packages/design/base.css` and `apps/admin-ui/src/styles/admin.css`
  were the previous attempt at this problem, and introduced the unreachable overflow. They are
  reverted; this design supersedes them.
- `docs/DESIGN.md` gains the measured breakpoints, the table above, and the rule that the header
  may wrap but may never clip — so the next person does not re-guess `72rem`.

## Not in scope

- Typography. The second rendition's display font is Bricolage Grotesque, it is in
  `packages/design/base.css`, and it was verified to paint in Chromium and Firefox, on an
  emulated Slow 3G connection with the cache disabled, with preloads matching the hashed asset
  URLs. Nothing was dropped and nothing needs restoring. (The Hugo mockup's Fraunces is the one
  font this project did drop; reinstating it is a separate, one-token change if it is ever
  wanted.)
- `font-display: optional` stays. The reason to revisit it was that it might explain a missing
  font; it does not.
- Navigation _structure_ — which links exist, and their labels — is unchanged.

## Verification

`just ci`, plus the new header specs. Screenshots at the full width ladder, before and after, in
both fonts, for both apps.
