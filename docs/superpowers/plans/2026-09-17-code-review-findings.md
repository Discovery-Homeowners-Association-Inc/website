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

## Deferred, with reasons

### 3. Nine identical catch blocks

`catch (e) { setError((e as Error).message) }` appears nine times across six
components. Beyond the repetition, `as Error` is a cast over a binding that is
genuinely `unknown` -- a rejected value need not be an Error, and if one is not,
this prints `undefined` to a volunteer.

A single `run(action)` helper would remove all nine and fix the unsafe cast in
one place. Deferred only because it touches six components at once and this
session has already changed a great deal; it is the first thing to do next.

### 4. The admin app has no page head

The site has `PageHead.astro` -- title, summary, breadcrumbs, one rule under it.
The admin app writes `<h1>` and `<p class="lede">` by hand in twelve components.
That is why the typography audit found the two apps disagreeing about a page
title's top margin: there was nothing holding it in one place.

Deferred: it is a component plus twelve edits, and worth doing on its own so the
diff is readable.

### 5. `apps/admin-ui/src/lib/settings.ts` is 725 lines

One declarative list describing every settings screen. Long, but it is data
rather than logic, and the length is the number of settings the board has. Worth
checking whether every field kind it supports is still used by something; not
worth restructuring.

### 6. `Minutes.tsx` is 652 lines

The largest component, carrying the whole minutes lifecycle: draft, review,
vote, approve, file. Splitting it by stage is plausible. Deferred until someone
has a reason to change it, because the split is not obvious and the file is
cohesive: every part is about one document moving through one process.

---

## Kept deliberately

### 7. Twelve components each hold their own `error` state

Twelve declare `const [error, setError] = useState("")`. This is the idiom, not
duplication: each component owns what it is doing. Extracting it into a shared
hook would couple twelve screens to one notion of failure to save twelve lines.
The catch _bodies_ are worth sharing (#3); the state is not.

### 8. `scripts/` holds four single-purpose scripts

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

`apps/admin/src/routes` beyond `meetings.ts`, the Preact components other than
those named above, and `packages/design/base.css` at 911 lines. "Nothing left
unturned" is not yet true, and saying so is more useful than implying otherwise.
