/**
 * Records the type and spacing both apps actually render, and reports where
 * they disagree.
 *
 * "Make the formatting consistent" is not a thing you can settle by eye across
 * forty screens. This walks both apps, reads the computed style of each element
 * role, and prints the disagreements so each one can be decided on purpose --
 * some of them should stand, because the admin app is denser than the public
 * site deliberately.
 *
 *   node scripts/type-audit.mjs [siteBase] [adminBase]
 *
 * It lives here because this package owns Playwright:
 *   pnpm --filter @dhoa/site exec node scripts/type-audit.mjs
 *
 * Set SIGN_IN_AS to an invited email before running it.
 */
import { chromium } from "@playwright/test";

const SITE = process.argv[2] ?? "http://127.0.0.1:4392";
const ADMIN = process.argv[3] ?? "http://127.0.0.1:8787";
const SIGN_IN_AS = process.env.SIGN_IN_AS;
if (!SIGN_IN_AS)
  throw new Error(
    "Set SIGN_IN_AS to an invited email for the developer sign-in.",
  );

/** The roles worth comparing: what a reader sees, not how it is built. */
const ROLES = {
  "page title (h1)": "main h1",
  // The summary under a page title is its own role; counting it as a body
  // paragraph made the first run compare a lede against ordinary prose.
  "page summary": ".page-head p, main p.lede",
  "section heading (h2)": "main h2",
  "sub heading (h3)": "main h3",
  "body paragraph": "main :not(.page-head) > p:not(.lede)",
  "link in text": "main :not(.page-head) > p:not(.lede) a",
  "list item": "main li",
  "table heading": "main th",
  "table cell": "main td",
  "form label": "main label",
  "primary button": "main .button, main button",
  "nav link": ".site-nav a",
  brand: ".brand span",
};

const PROPS = [
  "fontFamily",
  "fontSize",
  "fontWeight",
  "lineHeight",
  "letterSpacing",
  "marginTop",
  "marginBottom",
];

/*
 * Interior pages only, and the home page last. The site's home page is a hero by
 * design -- docs/DESIGN.md gives it the one bold element on the site -- so
 * comparing its 112px headline against an admin dashboard says nothing about
 * whether the two apps agree. What matters is whether a reader moving between an
 * ordinary page of one and an ordinary page of the other sees the same system.
 */
const SITE_PAGES = [
  "/documents/",
  "/meetings/",
  "/privacy/",
  "/rules/trash-recycling/",
  "/about/",
];
const ADMIN_PAGES = ["/content/", "/meetings/", "/people/", "/roster/", "/"];

async function collect(page, base, paths) {
  const found = new Map();
  for (const path of paths) {
    await page.goto(base + path, { waitUntil: "networkidle" }).catch(() => {});
    await page.waitForTimeout(400);
    const rows = await page.evaluate(
      ({ roles, props }) => {
        const out = {};
        for (const [role, selector] of Object.entries(roles)) {
          const el = [...document.querySelectorAll(selector)].find(
            (e) => e.getBoundingClientRect().width > 0,
          );
          if (!el) continue;
          const cs = getComputedStyle(el);
          out[role] = Object.fromEntries(props.map((p) => [p, cs[p]]));
        }
        return out;
      },
      { roles: ROLES, props: PROPS },
    );
    for (const [role, style] of Object.entries(rows))
      if (!found.has(role)) found.set(role, { style, where: path });
  }
  return found;
}

const shortFamily = (f) => f.split(",")[0].replaceAll('"', "").trim();
const tidy = (prop, v) => (prop === "fontFamily" ? shortFamily(v) : v);

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 900 },
});
const page = await ctx.newPage();

const site = await collect(page, SITE, SITE_PAGES);

await page.goto(`${ADMIN}/sign-in/`, { waitUntil: "networkidle" });
const field = page.getByLabel("Invited email");
if (await field.count()) {
  await field.fill(SIGN_IN_AS);
  await page.getByRole("button", { name: /Sign in without Google/ }).click();
  await page.waitForTimeout(2500);
}
const admin = await collect(page, ADMIN, ADMIN_PAGES);
await browser.close();

const roles = [...new Set([...site.keys(), ...admin.keys()])];
let differences = 0;
const lines = [];
for (const role of roles) {
  const s = site.get(role);
  const a = admin.get(role);
  if (!s || !a) {
    lines.push(
      `\n${role}\n  only on ${s ? "the site" : "admin"} — not compared`,
    );
    continue;
  }
  const diffs = PROPS.filter(
    (p) => tidy(p, s.style[p]) !== tidy(p, a.style[p]),
  );
  if (diffs.length === 0) continue;
  differences += diffs.length;
  lines.push(`\n${role}   (site ${s.where} vs admin ${a.where})`);
  for (const p of diffs)
    lines.push(
      `  ${p.padEnd(15)} site ${tidy(p, s.style[p]).padEnd(28)} admin ${tidy(p, a.style[p])}`,
    );
}

console.log(`Roles compared: ${roles.length}`);
console.log(lines.join("\n") || "\nNo differences.");
console.log(`\n${differences} differing properties across the two apps.`);
