# Code review: findings

Item G of `2026-09-17-admin-and-site-batch.md`. Duplication, simplification and
wasted work, area by area. Every finding says what happened to it: fixed, kept
with a reason, or deferred with a reason. A finding nobody acts on is still a
finding.

The codebase is 13,691 lines across six areas: `apps/admin-ui` 6,510,
`apps/site` 2,645, `apps/admin` 2,276, `packages/design` 1,103,
`packages/shared` 1,020, `scripts` 137.

---

## Fixed

### 1. `longDate` existed twice, character for character

`apps/site/src/lib/dates.ts` and `apps/admin-ui/src/lib/api.ts` each carried the
same formatter, including the same trick of parsing at noon UTC so a calendar
date never shifts a day for a reader behind UTC. Two apps formatting the same
dates for the same readers.

Moved to `packages/shared/src/dates.ts` with `monthShort` and `dayOfMonth`, and
a test for the two cases the noon trick exists for: an ordinary date, and the
first of a month, where an off-by-one crosses into the previous month.

### 2. The meeting labels existed three times, and disagreed

`board`, `annual`, `special` and `pool-rec` were named in the admin app's
`api.ts`, in the site's meeting page, and again in the agenda template settings.

They had already drifted, and a resident could see it: the site's upcoming list
called it a **"Board of directors meeting"**, while the meeting's own page and
the calendar feed called it a **"Board meeting"**. Two names for one thing,
depending on which link you followed.

Now `MEETING_LABEL` in `packages/shared`, read by both apps and the calendar
feed. The site's e2e test asserted the old string, and was updated deliberately:
the feed now says "Board meeting" like everything else.

---

### 3. Every error message was read off a value that might not be an Error — fixed

`catch (e) { setError((e as Error).message) }` appeared ten times, and
`(e: Error) => setError(e.message)` nine more — a rejection handler's value is
`unknown`, so annotating it `Error` is the same assertion in a different shape.
If anything ever rejected with a string, a volunteer saw "undefined".

`messageFrom(e)` in `lib/api.ts` narrows with `instanceof` and falls back to a
sentence a person can act on. Nineteen sites now use it; no cast remains in the
admin app.

The states stayed where they were, per finding #7: what was worth sharing was
the handling, not the twelve pieces of component state.

### 4. A CSS modifier the content asked for was never defined — fixed

Page content in the database uses `callout--note` — the Architectural Control
page marks "if you need help filling out the application" with it — and only
`callout--warning` was ever written. That aside had been rendering as a plain
callout. Defined against `--pool`, the quiet surface the tokens already reserve
for callouts.

**The finding underneath it matters more than the fix.** Page content is stored
in D1 and references classes from the design system, so a class is not dead
because the source does not mention it, and a modifier can be missing without
anything failing. Checking one without the other proves nothing.

### 5. Dead CSS: none, and the search itself was the lesson

A sweep for classes nothing references reported five. Every one was a false
positive: four `status--*` classes are built as `` `status status--${r.status}` ``
and `callout--warning` lives in database content. 103 classes defined, none
dead.

Worth recording so the next person does not delete them: **a class in this
project can be referenced dynamically, or from content in the database, and a
plain text search over the repository sees neither.**

## Deferred, with reasons

### 6. The admin app had no page head — fixed

The site has `PageHead.astro`; the admin app wrote `<h1>` and
`<p class="lede">` by hand in thirteen places. That is why the typography audit
found the two apps disagreeing about whether a page title has a top margin:
there was nothing holding it in one place.

`PageHead.tsx` now carries the title, the lede and the breadcrumbs, and uses the
same `.page-head` class as the site, so the rule under a title is defined once
for both apps. Eleven screens use it.

Two do not, deliberately: `Print.tsx` is a document going to paper, where a rule
and a lede would be wrong, and `SignIn.tsx` is a bare card with no navigation
around it.

Converting them turned up its own bug: two screens had their breadcrumbs left
outside the new head, because the crumbs and the title were written in separate
places. That is the duplication being what it was.

### 11. A query inside a loop, in a Worker with 10 ms of CPU — fixed

Creating an item made the slug unique by querying the database once per
attempt, inside `for (let n = 2; n < 50; n++)`. A popular title cost a round
trip per try, up to 48 of them, serialized.

It also never checked the name it settled on: at the 48th collision the loop
ended with an untested slug, so the unique constraint on the insert would have
reported the problem instead of the loop. Every candidate that could collide is
now read in one query and the free name chosen in memory.

### 12. One unused field kind — kept

`Form.tsx` renders sixteen field kinds. Fifteen are used; `kind: "time"` is not.
Every time in this project is a `text` field matching "7:00 pm", which is how the
board writes them and how they are displayed. Kept: it is three lines, and it
records a choice rather than an oversight.

### 7. `apps/admin-ui/src/lib/settings.ts` is 725 lines

One declarative list describing every settings screen. Long, but it is data
rather than logic, and the length is the number of settings the board has. Worth
checking whether every field kind it supports is still used by something; not
worth restructuring.

### 8. `Minutes.tsx` is 652 lines

The largest component, carrying the whole minutes lifecycle: draft, review,
vote, approve, file. Splitting it by stage is plausible. Deferred until someone
has a reason to change it, because the split is not obvious and the file is
cohesive: every part is about one document moving through one process.

---

## Kept deliberately

### 9. Twelve components each hold their own `error` state

Twelve declare `const [error, setError] = useState("")`. This is the idiom, not
duplication: each component owns what it is doing. Extracting it into a shared
hook would couple twelve screens to one notion of failure to save twelve lines.
The catch bodies were worth sharing and now are (#3); the state is not.

### 10. `scripts/` holds four single-purpose scripts

`snapshot.ts`, `check-seed-stable.sh`, `check-english.sh`,
`render-mark-png.sh`, plus `type-audit.mjs` under `apps/site`. Each does one
thing and is run by hand or by `just`. They share no logic worth extracting:
only `snapshot.ts` fetches anything.

---

## Found earlier in this session, already fixed

- **Every setting was published to the public site**, whether the site read it
  or not, because the snapshot schema was the whole registry. Settings now
  declare whether they are public.
- **`meetingOr404` typed a meeting's kind as `string`**, so looking anything up
  by kind needed a cast.
- **Form controls were styled independently in each app**, so a select, a date
  field and a text box in one row rendered at three different heights.

---

## Not yet reviewed

**Reviewed since:** `apps/admin/src/routes` — nine of the ten routes already
share `auditStatement`, and the largest, `minutes.ts` at 447 lines, is one
document's lifecycle rather than a pile. No duplication worth removing.
`packages/design/base.css` — no dead rules, see #5.

**Reviewed since:** `Form.tsx` and the field definitions -- fifteen of sixteen
field kinds are in use (#12). The Worker's routes were checked for work done in
a loop that belongs in one query; one was found and fixed (#11), and the other
two the search flagged were false positives.

**What that leaves:** the Preact components have been read for their page heads
and their error handling but not line by line for logic. `Minutes.tsx` at 652
lines and `settings.ts` at 725 remain deferred with reasons above. Every other
area has now been through a pass.
