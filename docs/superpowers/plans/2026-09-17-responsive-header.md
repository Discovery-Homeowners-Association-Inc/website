# Responsive header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One shared, sticky header for the public site and the admin app that fits every screen from 320px to 4K, in either font, and that cannot hide a navigation link without a test failing.

**Architecture:** The header markup moves into one `SiteHeader.astro` in `packages/design`, consumed by both Astro apps with a slot for the app-specific action. Its CSS keeps three width bands whose boundaries come from measurements, the link list wraps instead of clipping, and the phone panel is a plain wrapper `<div>` that becomes `display: contents` above 40rem so the action can sit inside the panel on a phone and in the header row on a desktop without duplicated DOM.

**Tech Stack:** Astro 7, plain CSS in `packages/design/base.css`, Playwright 1.63 (Chromium + Firefox on the site, Chromium in admin), `@axe-core/playwright`.

**Spec:** `docs/superpowers/specs/2026-09-17-responsive-header-design.md`

## Global Constraints

- Branch `fix/responsive-header`; `main` is ruleset-protected, so this lands by PR.
- Public repository. Never commit a secret. `just security` before every commit.
- Free plans only: Workers Free 10 ms CPU, D1, KV, public-repo Actions minutes.
- WCAG 2.2 AA: 4.5:1 text contrast, visible focus ring, full keyboard use, targets ≥ 24×24 px, focus not obscured.
- No third-party requests on public pages. Fonts stay self-hosted.
- Honour `prefers-reduced-motion`. Every page still prints cleanly.
- Conventional Commits, imperative subject, no trailing period, ≤ 72 chars.
- Prettier is the formatter: `pnpm exec prettier --write <files>` before every commit.
- Measured constants, used verbatim: one-row breakpoint **71rem**, phone breakpoint **40rem**, nav text **1rem**, brand **1.05rem**, mark **2.4rem**, link gap **1rem**, action padding **0.55rem 0.9rem**. Height budgets: one-row ≤ **80px**, middle ≤ **150px**, phone closed ≤ **72px**.

---

## File Structure

| File                                    | Responsibility                                                                                                                                                                              |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/design/test/header-checks.ts` | **Create.** The reusable header assertions both apps' specs call. Imported by relative path (Playwright does not transform files under `node_modules`, so a package export would not work). |
| `packages/design/SiteHeader.astro`      | **Create.** The one header component: brand, toggle, panel, nav list, action slot, enhancement script.                                                                                      |
| `packages/design/package.json`          | **Modify.** Export `./SiteHeader.astro`.                                                                                                                                                    |
| `packages/design/base.css`              | **Modify**, lines 263–417. The header's tokens, three bands, wrap-not-clip rule, sticky positioning.                                                                                        |
| `apps/site/src/layouts/Base.astro`      | **Modify**, lines 20–108 and 172–180. Render `SiteHeader`, drop the inline nav markup and toggle script.                                                                                    |
| `apps/admin-ui/src/layouts/Admin.astro` | **Modify**, lines 62–99. Render `SiteHeader` with the admin nav and the You/Sign out action.                                                                                                |
| `apps/admin-ui/src/styles/admin.css`    | **Modify**, lines 3–52. Delete the divergent header block.                                                                                                                                  |
| `apps/site/tests/header.spec.ts`        | **Create.** The site's width ladder × both fonts.                                                                                                                                           |
| `apps/site/tests/site.spec.ts`          | **Modify**, lines 72–85. Update the phone-menu test for the new markup.                                                                                                                     |
| `apps/admin-ui/tests/header.spec.ts`    | **Create.** The admin ladder, signed in as an administrator and as an editor.                                                                                                               |
| `docs/DESIGN.md`                        | **Modify.** Record the measured breakpoints and the wrap-not-clip rule.                                                                                                                     |

---

### Task 1: The assertion that was missing, and the wrap-not-clip fix

The smallest change that stops links disappearing. Everything else in this plan is layout polish on top of it.

**Files:**

- Create: `packages/design/test/header-checks.ts`
- Create: `apps/site/tests/header.spec.ts`
- Modify: `packages/design/base.css:339-360` (`.site-nav ul`), `:387-389` (`justify-content`), `:406-412` (phone overrides)

**Interfaces:**

- Consumes: nothing.
- Produces: `expectNoClippedLinks(page, selector?)`, `expectNoSidewaysScroll(page)`, `expectHeaderHeightAtMost(page, px, selector?)`, `expectTargetSize(page, selector?)`, `expectFocusVisible(page, selector?)`, and `LADDER: number[]` — all imported by relative path from both apps' specs.

- [ ] **Step 1: Write the shared checks**

Create `packages/design/test/header-checks.ts`:

```ts
import { expect, type Page } from "@playwright/test";

/** Widths that matter: phones, tablets, laptops, and both sides of each breakpoint. */
export const LADDER = [
  320, 360, 390, 414, 480, 600, 639, 640, 700, 768, 834, 900, 1000, 1024, 1100,
  1135, 1136, 1152, 1200, 1280, 1366, 1440, 1600, 1920,
];

/**
 * Every navigation link must lie inside its container. The old header put the
 * links in an end-justified nowrap flex container with a hidden scrollbar,
 * where overflow is unreachable — `scrollWidth === clientWidth` — so a link was
 * deleted outright rather than clipped. This is the assertion that catches it.
 */
export async function expectNoClippedLinks(page: Page, nav = ".site-nav") {
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

/** WCAG 2.2 2.4.11: a focused link is not hidden by anything, including its own container. */
export async function expectFocusVisible(page: Page, nav = ".site-nav") {
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
```

- [ ] **Step 2: Write the failing site spec**

Create `apps/site/tests/header.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import {
  LADDER,
  expectFocusVisible,
  expectNoClippedLinks,
  expectNoSidewaysScroll,
  expectTargetSize,
} from "../../../packages/design/test/header-checks";

/**
 * The header, across every width that matters, in the web font and in the
 * fallback font. `font-display: optional` means a first visit can legitimately
 * be drawn in the fallback, which is wider — so the fallback is the case the
 * layout has to survive, not an edge case.
 */
for (const font of ["web font", "fallback font"] as const) {
  test.describe(font, () => {
    test.beforeEach(async ({ context }) => {
      if (font === "fallback font")
        await context.route("**/*.woff2", (route) => route.abort());
    });

    for (const width of LADDER) {
      test(`no link is cut off at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto("/");
        if (width < 640)
          await page.getByRole("button", { name: "Menu" }).click();
        await expectNoClippedLinks(page);
        await expectNoSidewaysScroll(page);
        await expectTargetSize(page);
        await expectFocusVisible(page);
      });
    }
  });
}

test("every navigation link is reachable at the widest layout", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 900 });
  await page.goto("/");
  for (const label of [
    "Meetings",
    "Amenities",
    "Rules & requests",
    "Documents",
    "News & events",
    "Contact",
  ]) {
    await expect(
      page.getByRole("navigation", { name: "Main" }).getByRole("link", {
        name: label,
        exact: true,
      }),
    ).toBeVisible();
  }
});
```

- [ ] **Step 3: Run it and confirm it fails for the right reason**

```bash
just build
pnpm --filter @dhoa/site exec playwright test tests/header.spec.ts --project=chromium
```

Expected: FAIL on `fallback font > no link is cut off at 1152px` and every wider width, with `navigation links cut off by their container: ["Meetings"]`. The `web font` cases fail at 1152px and 1168px only. This is the reported bug, reproduced.

- [ ] **Step 4: Fix the list so it wraps instead of clipping**

In `packages/design/base.css`, replace the `.site-nav ul` rule (and its `::-webkit-scrollbar` companion) with:

```css
.site-nav ul {
  display: flex;
  /*
   * The list may WRAP. It must never clip: an end-justified nowrap flex
   * container with hidden overflow reports scrollWidth === clientWidth, so a
   * link that does not fit cannot be reached by any means — it is gone. End
   * alignment is done with an auto margin, which cannot overflow.
   */
  flex-wrap: wrap;
  gap: 0 var(--space-3);
  list-style: none;
  margin: 0;
  padding: 0;
  min-width: 0;
}
```

In the `min-width: 72rem` block, replace `justify-content: flex-end` on `.site-nav ul` with `margin-inline-start: auto`. In the `max-width: 52rem` block, delete the now-redundant `overflow-x: visible`.

- [ ] **Step 5: Run the spec and the existing suite**

```bash
just build
pnpm --filter @dhoa/site exec playwright test --project=chromium
```

Expected: all of `header.spec.ts` PASS; `site.spec.ts` still passes.

- [ ] **Step 6: Commit**

```bash
pnpm exec prettier --write packages/design apps/site/tests
just security
git add packages/design/base.css packages/design/test/header-checks.ts apps/site/tests/header.spec.ts
git commit
```

Subject: `fix(design): let the header's links wrap instead of vanishing`

---

### Task 2: One shared header component

Pure refactor, guarded by Task 1's spec and both existing suites. No visual change.

**Files:**

- Create: `packages/design/SiteHeader.astro`
- Modify: `packages/design/package.json`, `apps/site/src/layouts/Base.astro:20-108,172-180`, `apps/admin-ui/src/layouts/Admin.astro:62-99`, `apps/admin-ui/src/styles/admin.css:3-52`

**Interfaces:**

- Consumes: Task 1's CSS class names — `.site-header`, `.brand`, `.nav-toggle`, `.site-nav`.
- Produces: `SiteHeader` with props `{ title: string; subtitle: string; nav: { href: string; label: string; adminOnly?: boolean }[]; path: string; exactRoot?: boolean; class?: string }` and a named slot `action`. Emits the panel wrapper `div.site-nav-panel#site-nav`, which Tasks 3–5 style and script.

- [ ] **Step 1: Write the component**

Create `packages/design/SiteHeader.astro`:

```astro
---
import markSvg from "./dhoa-mark.svg?raw";

interface Props {
  title: string;
  subtitle: string;
  nav: { href: string; label: string; adminOnly?: boolean }[];
  path: string;
  /** Admin's "Home" is `/` and must match exactly, not prefix every page. */
  exactRoot?: boolean;
  class?: string;
}
const {
  title,
  subtitle,
  nav,
  path,
  exactRoot = false,
  class: extraClass,
} = Astro.props;
const current = (href: string) =>
  (href === "/" && exactRoot ? path === "/" : path.startsWith(href))
    ? "page"
    : undefined;
const mark = markSvg.replace(
  /role="img"\s+aria-label="[^"]*"/,
  'aria-hidden="true" focusable="false"',
);
---

<header class:list={["site-header", extraClass]}>
  <div class="wrap">
    <a class="brand" href="/">
      <Fragment set:html={mark} />
      <span>
        {title}
        <small>{subtitle}</small>
      </span>
    </a>
    <button
      class="button button--quiet nav-toggle"
      type="button"
      aria-expanded="false"
      aria-controls="site-nav"
    >
      Menu
    </button>
    <div class="site-nav-panel" id="site-nav">
      <nav class="site-nav" aria-label="Main">
        <ul>
          {nav.map((item) => (
            <li data-admin-only={item.adminOnly ? "" : undefined}>
              <a href={item.href} aria-current={current(item.href)}>
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div class="header-action">
        <slot name="action" />
      </div>
    </div>
  </div>
</header>
```

- [ ] **Step 2: Export it**

In `packages/design/package.json`, add to `exports`:

```json
    "./SiteHeader.astro": "./SiteHeader.astro",
```

- [ ] **Step 3: Use it on the public site**

In `apps/site/src/layouts/Base.astro`: add `import SiteHeader from "@dhoa/design/SiteHeader.astro";`, drop the `markSvg` import and the `current` helper, replace lines 69–108 with

```astro
<SiteHeader
  title="Discovery Homeowners"
  subtitle={`${org.locality}, ${org.state}`}
  nav={nav}
  path={path}
>
  <a class="button" href="/dues/" slot="action">
    Pay dues
  </a>
</SiteHeader>
```

and delete the `<script>` at lines 172–180 (Task 5 replaces it inside the component).

- [ ] **Step 4: Use it in admin**

In `apps/admin-ui/src/layouts/Admin.astro`, replace lines 62–99 with

```astro
{!bare && (
  <SiteHeader
    class="admin-header"
    title="Discovery HOA"
    subtitle="Board administration"
    nav={nav}
    path={path}
    exactRoot
  >
    <Fragment slot="action">
      <a href="/profile/" aria-current={current("/profile/")}>
        You
      </a>
      <form method="post" action="/api/auth/sign-out" data-sign-out>
        <button class="button button--quiet button--small" type="submit">
          Sign out
        </button>
      </form>
    </Fragment>
  </SiteHeader>
)}
```

adding the `SiteHeader` import and dropping the `markSvg` import. Keep the `current` helper — the action slot still uses it for `/profile/`.

- [ ] **Step 5: Delete admin's divergent header CSS**

In `apps/admin-ui/src/styles/admin.css`, delete the comment block and both media-query blocks at lines 3–52, keeping the `html:not([data-admin]) [data-admin-only]` rule and everything after it. Admin now inherits the shared bands.

- [ ] **Step 6: Run everything**

```bash
just build
pnpm --filter @dhoa/site exec playwright test --project=chromium
pnpm --filter @dhoa/admin-ui run lint
pnpm --filter @dhoa/site run lint
```

Expected: PASS. The `.admin-you` rules in `admin.css` still style the action slot's contents.

- [ ] **Step 7: Commit**

```bash
pnpm exec prettier --write packages apps
just security
git add packages/design apps/site/src/layouts/Base.astro apps/admin-ui/src
git commit
```

Subject: `refactor(design): share one header between the site and admin`

---

### Task 3: Tier B sizing and the measured breakpoints

**Files:**

- Modify: `packages/design/base.css` (header bands), `apps/site/tests/header.spec.ts`

**Interfaces:**

- Consumes: Task 2's markup, Task 1's `expectHeaderHeightAtMost`.
- Produces: the three bands the later tasks assume — `>= 71rem`, `40rem`–`71rem`, `< 40rem`.

- [ ] **Step 1: Add the height-budget assertions to the site spec**

In `apps/site/tests/header.spec.ts`, import `expectHeaderHeightAtMost` and add inside the per-width test, before the menu click:

```ts
const budget = width >= 1136 ? 80 : width >= 640 ? 150 : 72;
await expectHeaderHeightAtMost(page, budget);
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
just build
pnpm --filter @dhoa/site exec playwright test tests/header.spec.ts --project=chromium
```

Expected: FAIL — `header height: expected 137 to be less than or equal to 80` at 1136px (the band has not moved yet), and `141` against 72 on every phone width.

- [ ] **Step 3: Apply Tier B and move the breakpoints**

In `packages/design/base.css`: set `.brand svg { width: 2.4rem }`, `.brand span { font-size: 1.05rem }`, add `.site-nav a { font-size: 1rem }`, and `.header-action .button { padding: 0.55rem 0.9rem }`. Change the wide media query from `min-width: 72rem` to `min-width: 71rem`, and the narrow one from `max-width: 52rem` to `max-width: 39.99rem`. Update the block comment above `.site-header` to the measured table from the spec.

- [ ] **Step 4: Run it**

```bash
just build
pnpm --filter @dhoa/site exec playwright test tests/header.spec.ts --project=chromium
```

Expected: the `>= 1136px` and middle-band budgets PASS. Phone widths still FAIL at 72px — Task 4 fixes those.

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write packages/design apps/site/tests
just security
git add packages/design/base.css apps/site/tests/header.spec.ts
git commit
```

Subject: `fix(design): set the header's breakpoints from its measured width`

---

### Task 4: A one-row phone header with an overlay panel

**Files:**

- Modify: `packages/design/base.css` (phone band), `apps/site/tests/site.spec.ts:72-85`

**Interfaces:**

- Consumes: `.site-nav-panel` from Task 2, the `< 40rem` band from Task 3.
- Produces: the closed phone header at ≤ 72px, and the panel as an overlay that does not change page height.

- [ ] **Step 1: Write the failing overlay test**

Add to `apps/site/tests/header.spec.ts`:

```ts
test("the phone panel overlays the page instead of pushing it down", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const heading = page.getByRole("heading", { level: 1 });
  const before = (await heading.boundingBox())!.y;
  await page.getByRole("button", { name: "Menu" }).click();
  await expect(
    page.getByRole("navigation", { name: "Main" }).getByRole("link", {
      name: "Meetings",
      exact: true,
    }),
  ).toBeVisible();
  const after = (await heading.boundingBox())!.y;
  expect(after, "opening the menu moved the page").toBe(before);
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
just build
pnpm --filter @dhoa/site exec playwright test tests/header.spec.ts --project=chromium -g "overlays"
```

Expected: FAIL — the heading moves down by roughly 275px.

- [ ] **Step 3: Write the phone band**

Replace the `max-width: 39.99rem` block in `packages/design/base.css` with:

```css
/* Phone: one row, links and the action in a panel that overlays the page. */
@media (max-width: 39.99rem) {
  .site-header .wrap {
    position: relative;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas: "brand toggle";
    padding-block: var(--space-2);
  }
  .brand svg {
    width: 2.1rem;
  }
  .button.nav-toggle {
    grid-area: toggle;
    display: inline-flex;
    justify-self: end;
  }
  .site-nav-panel {
    position: absolute;
    inset-inline: 0;
    top: 100%;
    background: var(--surface);
    border-bottom: 1px solid var(--rule);
    box-shadow: 0 0.5rem 1.5rem rgb(0 0 0 / 15%);
    padding: 0 var(--gutter) var(--space-3);
  }
  .site-nav ul {
    flex-direction: column;
    gap: 0;
  }
  .site-nav li a {
    display: block;
    border-bottom: 1px solid var(--rule);
    border-left: 3px solid transparent;
    padding-inline-start: var(--space-2);
  }
  .site-nav a[aria-current="page"] {
    border-bottom-color: var(--rule);
    border-left-color: var(--marigold);
  }
  .header-action {
    margin-top: var(--space-3);
  }
}

/* Above the phone band the panel is not a box at all: its children become
 * header grid items, so the action sits in the header row. `display: contents`
 * is on this plain wrapper, never on the <nav>, whose landmark must survive. */
@media (min-width: 40rem) {
  .site-nav-panel {
    display: contents;
  }
  .site-nav {
    grid-area: nav;
  }
}
```

- [ ] **Step 4: Update the existing phone-menu test**

In `apps/site/tests/site.spec.ts`, replace the body of "the menu button opens the navigation on a phone" so it targets the button by role and the panel by its links:

```ts
await page.setViewportSize({ width: 390, height: 844 });
await page.goto("/");
const nav = page.getByRole("navigation", { name: "Main" });
await expect(nav).toBeHidden();
await page.getByRole("button", { name: "Menu" }).click();
await expect(
  nav.getByRole("link", { name: "Meetings", exact: true }),
).toBeVisible();
await expect(page.getByRole("link", { name: "Pay dues" })).toBeVisible();
```

- [ ] **Step 5: Run the whole site suite**

```bash
just build
pnpm --filter @dhoa/site exec playwright test --project=chromium --project=firefox
```

Expected: PASS, including every phone width against the 72px budget.

- [ ] **Step 6: Commit**

```bash
pnpm exec prettier --write packages/design apps/site/tests
just security
git add packages/design/base.css apps/site/tests
git commit
```

Subject: `fix(design): give phones a one-row header and an overlay menu`

---

### Task 5: The menu stops depending on JavaScript

**Files:**

- Modify: `packages/design/SiteHeader.astro`, `packages/design/base.css`, `apps/site/tests/header.spec.ts`

**Interfaces:**

- Consumes: `.site-nav-panel`, `.nav-toggle` from Task 2.
- Produces: `html[data-js]` as the marker that scripting is available; the toggle's label swaps between "Menu" and "Close".

- [ ] **Step 1: Write the failing tests**

Add to `apps/site/tests/header.spec.ts`:

```ts
test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("every navigation link is still reachable on a phone", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    for (const label of ["Meetings", "Amenities", "Contact"]) {
      await expect(
        page.getByRole("navigation", { name: "Main" }).getByRole("link", {
          name: label,
          exact: true,
        }),
      ).toBeVisible();
    }
  });
});

test("Escape closes the menu and returns focus to the button", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Menu" });
  await toggle.click();
  await expect(page.getByRole("button", { name: "Close" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toBeFocused();
});

test("a click outside closes the menu", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("heading", { level: 1 }).click();
  await expect(page.getByRole("button", { name: "Menu" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
});
```

- [ ] **Step 2: Run them and confirm they fail**

```bash
just build
pnpm --filter @dhoa/site exec playwright test tests/header.spec.ts --project=chromium -g "JavaScript|Escape|outside"
```

Expected: the no-JS test FAILS because the panel is hidden with no way to open it; the Escape and outside-click tests FAIL because nothing listens.

- [ ] **Step 3: Flip the default and add the enhancement**

In `packages/design/SiteHeader.astro`, add before the `<header>`:

```astro
<script is:inline>
  // Scripting is available, so the panel may start closed. Set before first
  // paint: without this the phone panel would flash open on every load, and
  // with no script at all the links stay visible instead of being unreachable.
  document.documentElement.setAttribute("data-js", "");
</script>
```

and append after the `</header>`:

```astro
<script>
  const toggle = document.querySelector<HTMLButtonElement>(".nav-toggle");
  const header = document.querySelector(".site-header");
  if (toggle && header) {
    const setOpen = (open: boolean) => {
      toggle.setAttribute("aria-expanded", String(open));
      toggle.textContent = open ? "Close" : "Menu";
    };
    toggle.addEventListener("click", () =>
      setOpen(toggle.getAttribute("aria-expanded") !== "true"),
    );
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (toggle.getAttribute("aria-expanded") !== "true") return;
      setOpen(false);
      toggle.focus();
    });
    document.addEventListener("click", (event) => {
      if (toggle.getAttribute("aria-expanded") !== "true") return;
      if (header.contains(event.target as Node)) return;
      setOpen(false);
    });
  }
</script>
```

In `packages/design/base.css`, inside the phone band, hide the panel only when scripting is present and the button is closed:

```css
html[data-js] .nav-toggle[aria-expanded="false"] + .site-nav-panel {
  display: none;
}
```

and drop any `.site-nav[data-open="false"]` rule left from the old markup.

- [ ] **Step 4: Run the suite in both browsers**

```bash
just build
pnpm --filter @dhoa/site exec playwright test --project=chromium --project=firefox
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write packages/design apps/site/tests
just security
git add packages/design apps/site/tests
git commit
```

Subject: `fix(design): keep the menu usable without JavaScript`

---

### Task 6: A sticky header

**Files:**

- Modify: `packages/design/base.css`, `apps/site/tests/header.spec.ts`

**Interfaces:**

- Consumes: `.site-header` from Task 2.
- Produces: `--header-z`, available to the admin app's notices and dialogs.

- [ ] **Step 1: Write the failing test**

```ts
test("the header stays put when the page scrolls", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  await page.goto("/documents/");
  await page.evaluate(() => window.scrollTo(0, 1200));
  const box = (await page.locator(".site-header").boundingBox())!;
  expect(Math.round(box.y), "header top after scrolling").toBe(0);
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
just build
pnpm --filter @dhoa/site exec playwright test tests/header.spec.ts --project=chromium -g "stays put"
```

Expected: FAIL — `expected -1200 to be 0`.

- [ ] **Step 3: Make it sticky**

Add `--header-z: 20;` to the `:root` token block in `packages/design/base.css`, and to `.site-header`:

```css
position: sticky;
top: 0;
z-index: var(--header-z);
```

Give the skip link a higher `z-index` (`calc(var(--header-z) + 1)`), add `main :target, #main { scroll-margin-top: 6rem; }` so anchored content is not hidden under it, and in the site's `@media print` block add `.site-header { position: static; }`.

- [ ] **Step 4: Run the suite**

```bash
just build
pnpm --filter @dhoa/site exec playwright test --project=chromium --project=firefox
```

Expected: PASS, focus-visibility assertions included — the sticky header must not cover a focused link.

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write packages/design apps/site
just security
git add packages/design apps/site
git commit
```

Subject: `feat(design): keep the header in view while the page scrolls`

---

### Task 7: The admin ladder, the docs, and the pull request

**Files:**

- Create: `apps/admin-ui/tests/header.spec.ts`
- Modify: `docs/DESIGN.md`

**Interfaces:**

- Consumes: every assertion from Task 1; the admin dev sign-in endpoint and bootstrap token used by `apps/admin-ui/tests/content.spec.ts:59-66`.
- Produces: nothing downstream.

- [ ] **Step 1: Write the admin spec**

Create `apps/admin-ui/tests/header.spec.ts`:

```ts
import AxeBuilder from "@axe-core/playwright";
import { type Browser, expect, test } from "@playwright/test";
import {
  LADDER,
  expectFocusVisible,
  expectHeaderHeightAtMost,
  expectNoClippedLinks,
  expectNoSidewaysScroll,
  expectTargetSize,
} from "../../../packages/design/test/header-checks";

/** The admin header carries seven links for an administrator and five otherwise. */
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

test.beforeAll(async ({ request }) => {
  const res = await request.post("/api/bootstrap", {
    headers: {
      authorization: "Bearer e2e-bootstrap-token-for-tests-only-0123456789",
    },
    data: { email: ADMIN, name: "Sam Secretary" },
  });
  expect([201, 409]).toContain(res.status());
});

test("the administrator's header fits every width", async ({ browser }) => {
  const page = await signIn(browser, ADMIN);
  for (const width of LADDER) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    if (width < 640) await page.getByRole("button", { name: "Menu" }).click();
    await expectNoClippedLinks(page);
    await expectNoSidewaysScroll(page);
    await expectTargetSize(page);
    await expectFocusVisible(page);
    await expectHeaderHeightAtMost(
      page,
      width >= 1136 ? 80 : width >= 640 ? 150 : 72,
    );
  }
  const { violations } = await new AxeBuilder({ page })
    .include(".site-header")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(violations.map((v) => v.id)).toEqual([]);
});
```

- [ ] **Step 2: Run it**

```bash
pnpm --filter @dhoa/admin-ui run build
pnpm --filter @dhoa/admin-ui exec playwright test tests/header.spec.ts
```

Expected: PASS. If the administrator's seven links need more than `71rem`, raise the admin one-row breakpoint in `admin.css` to the measured figure and record it in `docs/DESIGN.md` — do not lower the assertion.

- [ ] **Step 3: Record the decisions in the design doc**

In `docs/DESIGN.md`, under a new "## The header" heading, add the band table from the spec, the measured minimum widths, and:

```markdown
The header may wrap but must never clip. The link list is a wrapping flex
container with no overflow box; end alignment uses an auto margin, because
end-justified flex overflow is unreachable — `scrollWidth === clientWidth`, so a
link that does not fit is gone rather than scrollable. `apps/site/tests/header.spec.ts`
asserts this at every width in both fonts; change the breakpoints only by
re-measuring, never by relaxing the assertion.
```

- [ ] **Step 4: Run everything CI runs**

```bash
just ci
```

Expected: PASS end to end.

- [ ] **Step 5: Commit and open the pull request**

```bash
pnpm exec prettier --write .
git add apps/admin-ui/tests/header.spec.ts docs/DESIGN.md
git commit
git push -u origin fix/responsive-header
gh pr create --fill
```

Subject: `test(admin-ui): assert the admin header fits every width`
PR title: `fix: one measured, shared header for the site and admin app`

---

## Self-Review

**Spec coverage.** §1 shared component → Task 2. §2 Tier B sizing and `71rem` → Task 3. §3 wrap-not-clip → Task 1. §4 three bands, budgets, overlay panel, sticky → Tasks 3, 4, 6. §5 no-JS, Escape, outside click, label → Task 5. §6 all seven assertions → Task 1 (helper), 3 (height), 5 (no-JS), 7 (axe, admin). §7 housekeeping → already done on the branch before the spec commit. "Not in scope" carries no task, correctly.

**Placeholders.** None: every step names exact files and shows the code. The one conditional is Task 7 Step 2, which states the rule (re-measure, never relax) rather than leaving a decision open.

**Type consistency.** `expectNoClippedLinks`, `expectNoSidewaysScroll`, `expectHeaderHeightAtMost`, `expectTargetSize`, `expectFocusVisible` and `LADDER` are defined in Task 1 Step 1 and used under those exact names in Tasks 1, 3 and 7. `SiteHeader`'s prop names in Task 2 Step 1 match every call site in Steps 3 and 4. `.site-nav-panel`, `.nav-toggle`, `html[data-js]` and `--header-z` are introduced once and referenced consistently.
