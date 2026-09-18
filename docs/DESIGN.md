# Design

## Concept: the site plan

Discovery was drawn as a whole in 1972, as Frederick County's first planned community. It had
houses, parks and a pool on one plan, and its streets were named for an idea: Revelation,
Inquiry, Eureka, Imagination. The site borrows from that plan rather than from a generic
"community" template.

- **The street map is the one bold element.** It is drawn from OpenStreetMap data, and
  Discovery's own streets are picked out in plan blue. It appears on the home page and nowhere
  else.
- **Everything else is quiet.** Text is left-aligned, layouts sit on a clear grid, and there is
  no decoration that isn't carrying information.
- **The site is for residents, not visitors.** The first screen answers the questions people
  actually arrive with: when the next meeting is, when trash goes out, how to pay, who to call.

## Tokens

| Token        | Light     | Dark      | Role                                                                         |
| ------------ | --------- | --------- | ---------------------------------------------------------------------------- |
| `--paper`    | `#F4F6F5` | `#101A22` | Page ground: a cool gray-white, not cream                                    |
| `--ink`      | `#1A2530` | `#E4EAEE` | Text                                                                         |
| `--plan`     | `#1F4FA8` | `#8DB2F7` | Links, primary actions, Discovery's streets on the map                       |
| `--marigold` | `#F2B43A` | `#F2B43A` | The sun from the association mark. Used for highlight fills only, never text |
| `--pool`     | `#D6EEEA` | `#17343A` | Quiet surfaces: callouts, the "at a glance" band                             |
| `--rule`     | `#C9D2D8` | `#2A3A46` | Borders and dividers                                                         |

## Type

- **Bricolage Grotesque** (variable weight and width) for headings. It is a grotesque with
  1970s character; large headings are set heavy and slightly condensed.
- **Atkinson Hyperlegible Next** for body text. It was designed by the Braille Institute for
  low-vision readers, and many residents are older. The base size is 18px with 1.6 line
  height and a line length of at most 68ch.
- The scale is a major third (1.25). Labels are sentence case, never all caps.

## The header

One component, `packages/design/SiteHeader.astro`, serves the public site and the admin
app. Each boundary below was measured, not chosen: at these sizes one row needs 1090px in
the web font and 1120px in the fallback, hence 71rem with 16px of headroom. The phone band
ends where the links fit on **one line** rather than merely fitting — 0.92 × viewport ≥
627px of links means 682px, hence 44rem.

| Band          | Layout                                | Site  | Admin |
| ------------- | ------------------------------------- | ----- | ----- |
| ≥ 71rem       | brand · links · action, one row       | 72px  | 78px  |
| 44rem – 71rem | brand · action, then links on one row | 124px | 124px |
| < 44rem       | brand · Menu, panel over the page     | 60px  | 60px  |

Budgets asserted by the tests: 80px, 150px, 72px. Below 23rem the locality line is dropped,
which is what keeps the brand beside the Menu button instead of on three rows.

**The header may wrap but must never clip.** The link list is a wrapping flex container with
no overflow box, and end alignment uses an auto margin. End-justified flex overflow is
unreachable — `scrollWidth === clientWidth` — so a link that does not fit is _gone_ rather
than scrollable. That is what used to remove part of "Meetings" at every width from 1152px
up in the fallback font. `apps/site/tests/header.spec.ts` and
`apps/admin-ui/tests/header.spec.ts` assert this at 25 widths in both fonts; change a
breakpoint only by re-measuring, never by relaxing the assertion.

The Menu button is an enhancement, not a requirement: the panel is visible by default and
hidden only under `html[data-js]`, so a visitor without JavaScript gets the links rather
than nothing at all.

## Fonts

`font-display: swap`, never `optional` — `optional` lets a browser keep the fallback for a
whole page load and never swap, so a slow first visit could show the wrong typeface from
start to finish.

The reflow a swap would cause is reduced by naming the local fonts a visitor actually has
and scaling them with `size-adjust`. The ratios were measured in a browser against what
actually renders:

| Text                        | Measured need |
| --------------------------- | ------------- |
| Body font, prose at 400     | 98.83%        |
| Body font, nav links at 600 | 103.79%       |
| Display font, brand at 700  | 108.94%       |

One ratio per family cannot serve every weight, so each is set to the value that keeps the
fallback **no wider** than the web font: a narrower fallback cannot clip anything or push
the header past a breakpoint, and a wider one is precisely what broke it. Prose lands within
1px over 2114px, so the swap is invisible where most of the page is.

Inlining the fonts as `data:` URIs was considered and rejected: 161.7KB of woff2 becomes
~221KB of base64 on a 12.4KB stylesheet, and CSS blocks rendering — a blank screen beats
readable fallback text for nobody.

## Maps

There is one map drawing, `apps/site/src/assets/discovery-map.svg`, rendered from
OpenStreetMap geometry by `render-neighborhood-map.py` in the association's tools
repository. It carries CSS classes rather than baked-in colors, so it follows the palette
into dark mode, weighs about 11KB, and asks nothing of any third party at runtime. No tile
service, no map library, no runtime fetch: the same reasons the rest of the site is static.

Two pages use it. The home page crops it to the neighborhood as a backdrop. The parks page
(`ParkMap.astro`) crops it tighter and lays a marker over each park and shared amenity,
with a key beside it.

The markers are ordinary elements positioned as a percentage of the picture's box, not
shapes spliced into the SVG. The SVG scales to its box, so a percentage lands on the spot
the projection gives at any width; a marker stays something CSS can style, a pointer can
hit and a keyboard can reach; and nothing has to build SVG markup inside Astro frontmatter,
which its parser reads as the end of the surrounding element.

Each marker is a link to its own entry in the full list, and picking one names it in the
panel beside the map. That ordering matters: the link is what works with no JavaScript, and
the panel is the enhancement on top of it. The map is therefore the interface rather than a
picture with an index underneath, which is why the list is folded into a disclosure instead
of being spelled out at full length — a row per place saying "Park 12 / Off Treasure
Avenue" said what the marker already says, and pushed the map off the screen.

Markers carry an accessible name of their own ("Park 12, off Treasure Avenue"), so the map
is usable by keyboard and screen reader without the list being open. The detail panel is
not a live region: the marker announces itself when focused, and announcing it twice is
worse than once.

Each place says two things, and the distinction is worth keeping: `where` is the street a
resident would name, derived from the survey; `what` is the equipment, transcribed from the
board's own "Parks Description". The second is the reason to pick a marker at all — knowing
Park 20 has a full basketball court and a merry go round is what someone came to the page
for.

`apps/site/src/lib/map.ts` holds the projection, which is a copy of the renderer's — a unit
test checks it against the asset's own viewBox, because if the map is ever re-rendered from
different data every marker silently shifts, and nothing else would notice. A browser test
checks the markers land inside the picture, for the same reason.

Where the positions come from is a separate question, answered in
`apps/site/scripts/park-positions.mjs`: the association's only record of its parks is a
hand drawing that is not to scale. They are estimates good to something like the width of a
house, the page says so, and the board corrects any of them in Settings.

## Where the admin app differs, and why

The two apps share `packages/design/base.css`, so they agree unless something
says otherwise. These are the differences that are meant to be there, measured
on 2026-09-17 with `apps/site/scripts/type-audit.mjs`. Re-run it rather than
judging by eye, and add a line here before introducing a new difference.

| Role       | Site       | Admin      | Why                                                                                                |
| ---------- | ---------- | ---------- | -------------------------------------------------------------------------------------------------- |
| Page title | up to 68px | up to 35px | The site's front page carries the one bold element; the admin app is a tool people work in all day |

There used to be a second row here claiming section headings were 28px on the
site and 22.5px in the admin app. That difference does not exist and never did:
`admin.css` sets only a top margin on `h2` and never a size, so a bare heading
is `--step-2` in both apps, and `.panel h2` is `--step-1` in both — the rule is
in the shared base. The audit had sampled a panel heading in one app and a bare
heading in the other, and the selector rather than the design decided the
answer. Which is the argument for re-running it _and_ reading what it matched.

Everything else the audit found was a difference nobody chose, and was fixed:
page titles carried a stray top margin in the admin app, sections had no space
above them, and the "what is this?" explanations were set 4px smaller than body
text — which is the text someone reads when they are unsure, for an audience the
18px base was chosen for.

## Rules we hold ourselves to

- WCAG 2.2 AA: text contrast of at least 4.5:1, a visible focus ring, and full keyboard use.
- Marigold never carries text; the ink color sits on top of it.
- No third-party requests on public pages. Fonts are self-hosted.
- Honor `prefers-reduced-motion`. The only motion is the map drawing in once on load.
- Every page prints cleanly.
