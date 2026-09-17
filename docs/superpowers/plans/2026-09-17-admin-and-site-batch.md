# Admin and site: the September batch

Work queued on 2026-09-17, in the order it should be done. Each item says what
"done" means, because several of these are easy to declare finished early.

**Spec for the header work that preceded this:**
`docs/superpowers/specs/2026-09-17-responsive-header-design.md`

---

## Done

### A. The profile link is a person, not the word "You" — #14

At the header's size the word read as a stray navigation item. The label
survives for screen readers and as a tooltip; the target is 40px square.

### B. Form controls, shared with the site — #14

The admin styled its own inputs, so the two apps diverged by construction. A
select, a date field and a text box in one row measured 46, 51, 49 and 49
pixels at four different offsets; they are 48 at one offset now. Controls live
in `packages/design/base.css`, and a `.row` is a grid whose fields share it as a
subgrid, so label, control and hint line up even when a label wraps.

Found while measuring: the role checkboxes drew at the browser's 13px, under the
24px WCAG 2.2 target minimum. `apps/admin-ui/tests/forms.spec.ts` now guards
both, and guards its own sample size first.

### E. Google OAuth branding assets

- `packages/design/dhoa-mark-120.png` — 120×120, 2.5 KB, square, white ground.
  Regenerate with `scripts/render-mark-png.sh [size]` (librsvg + ImageMagick,
  both OS packages, so no dependency was added for it).
- `/privacy/` and `/terms/` — drafted from what the site actually does, seeded
  as admin-editable pages like every other page, and linked in the footer.

---

## Not done

### F. The typographic and spacing audit — both apps, and between them

B fixed the form controls, which is where the reported complaint was. It is not
the whole of "review all the formatting". This item is the deliberate pass, and
it is not finished until it is evidence-based rather than impressionistic.

**What it covers.** Every heading level, body size, line-height, measure, and
vertical rhythm on both apps, plus the spacing scale between them: panels,
tables, list rows, page heads, and the gap above and below each.

**How to do it so it stays done.** Not by eye. Walk both apps' screens with a
script that records, per element role, the computed font-family, size, weight,
line-height and margins; then diff the admin's values against the site's and
against the scale in `docs/DESIGN.md`. The output is a table of every place they
disagree. Decide each disagreement deliberately — some are right, because admin
is denser on purpose — and record the ones that are intentional so the next pass
does not re-litigate them.

**Known disagreements to start from:**

- `h1` on the site is `--step-4` (a clamp up to 4.25rem); admin's is a separate
  `clamp(1.75rem, 1.2rem + 2.2vw, var(--step-3))`. Probably deliberate. Say so.
- The meetings table stops short of the panel above it, so a full-width panel
  sits over a narrower table on the same screen.
- `.tasks`, `.dated` and the admin's tables are three treatments of the same
  idea — a list of records with a date and a title.

**Done means:** a recorded table of differences, each marked kept or changed;
the changed ones fixed; and a test in the manner of `forms.spec.ts` covering
whichever of them can be asserted.

### C. Meetings: materialise records from the recurrence rule

**Decided:** the admin keeps the next N meetings as real records, created from
the rule, and the site renders records instead of generating dates.

Today the two apps mean different things by "meeting". The site calls
`boardMeetings(today, 6)` and generates six dates from the rule in settings; it
never reads the meetings table. The admin lists records, of which production has
exactly one, dated 2026-09-15. So the site advertises meetings that do not exist
as records, and there is nothing for an agenda to attach to.

**Done means:** one source of truth. The site's upcoming list and the admin's
list cannot disagree, a generated meeting can be cancelled or moved, and every
meeting the site shows can carry an agenda.

### D. Default agendas per meeting type, with suggestions

Blocked on C: an agenda template has nothing to attach to until meetings are
records.

Wanted: a default agenda per meeting type, items easy to add and remove, and
suggested topics drawn from prior meetings and from things left needing
follow-up. The suggestion half is the part with real design in it — what counts
as "needs follow-up" is a question about how the board actually works, not a
query to write.

---

## Two bugs found while doing the above

### The seed is not idempotent for roster people

`just seed-local` is documented "(idempotent)". It is not: running it a second
time duplicated all ten roster people. Committees survived, so whatever gives
them a stable identity is missing for people, which get a fresh `randomUUID`.

This is pointed at production. `docs/RUNBOOK-admin.md` step 2 tells you to run
`node scripts/seed.ts` against the live database, and running it twice would
duplicate the whole board on the public site. Fix before anyone re-seeds.

### Direct database writes do not clear the public snapshot cache

Caching the snapshot (#13) means content changes clear the entry through
`siteChanged`. Writes that bypass the app — seeding, or `wrangler d1 execute` —
do not, so the site build can read a snapshot up to five minutes stale, and
locally the cache persists on disk across restarts under
`apps/admin/.wrangler/state/v3/cache`. Recorded in the runbook. Worth revisiting
if seeding ever becomes routine rather than a first-deployment step.
