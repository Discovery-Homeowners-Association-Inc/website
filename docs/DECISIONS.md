# Decisions

Short records of choices that are expensive to reverse or easy to undo by accident. Each says
what was decided, why, and what would make us revisit it. The earlier Hugo mockup's decision log
is in `discovery-homeowners-association-inc.github.io/docs/DECISIONS.md`; the parts still relevant
are carried forward here.

---

## 1. Astro and TypeScript for everything

**Decision.** The public site is static Astro. The admin app is a TypeScript Cloudflare Worker.
Shared rules (the minutes lifecycle, the meeting schedule) live in `packages/shared` and are used
by both.

**Why.** One language across the site, the API and the admin UI, so validation and business rules
are written once. The cost is a Node toolchain, which the mockup avoided. mise pins the versions,
the lockfile is committed, and Dependabot keeps both current.

**Revisit if** the admin app is dropped and the site goes back to being edited by hand.

## 2. Page views never reach a Worker or a database

**Decision.** The public site is plain static files. Only the admin app and form posts, such as a
newsletter sign-up, run Worker code or touch D1.

**Why.** It keeps the association far inside Cloudflare's free limits (100,000 Worker requests and
5 million D1 row reads a day) however much the public site is visited. It also means the site keeps
working if the Worker is broken.

## 3. D1 now; R2 when a card is on the account

**Decision.** Workflow data (users, roles, meetings, agenda and minutes versions, comments, votes,
the audit log) goes in D1. Public PDFs stay in the repository under `apps/site/public/documents/`
for now. R2 is enabled later, when a payment method is added to the account for the domain
transfer.

**Why.** Enabling R2 requires a credit card and the association is not ready to add one. Nothing
needs R2 yet: the documents total about 1 MB, and minutes are structured text in D1.

**Revisit when** a card is on file. Move public PDFs to an R2 bucket on a custom domain, keeping
their `/documents/<name>.pdf` paths. Add a private bucket if drafts ever need attachments.

## 4. Approved minutes live in PayHOA, not on the website

**Decision.** The admin app handles the whole process: drafting, board review, the vote, and an
approved version that cannot change afterwards. The final step is **filed**. The secretary exports
the approved version as a PDF, uploads it to PayHOA's resident portal by hand, and records the
upload. The public site links to the portal for minutes and never shows them.

Agendas are different. They are published on the public meetings page before each meeting, and
they can also be exported as a PDF.

**Why.** The association already keeps minutes in PayHOA, which only residents can reach, and
intends to keep doing so. PayHOA has no upload API that we know of, so the hand-off is manual.

**Revisit if** PayHOA offers an API for documents, or the board decides minutes should also be
public.

## 5. The public site is a Cloudflare assets-only Worker

**Decision.** `apps/site` deploys as its own Worker, `dhoa-site`, carrying nothing but static
files: no `main`, so no Worker code ever runs for a page view. GitHub Actions builds it and runs
`wrangler deploy`.

**Why.** Cloudflare documents that "requests to static assets are free and unlimited" and never
invoke the Worker, so the public site cannot cost anything or eat into the 100,000 requests a day
the admin Worker needs, however busy it gets. That makes decision #2 a property of the platform
rather than of our discipline. Beyond that:

- HTTPS can be validated all the way to the origin (Full (strict)). GitHub Pages behind the
  Cloudflare proxy cannot validate the Cloudflare-to-GitHub hop (see the mockup's decision #6).
- Everything lives on one platform, with one deploy mechanism we already run for the admin Worker.
- Pages' free build allowance would go unused: the site has to be built in Actions anyway, to fetch
  published content from `SITE_CONTENT_URL` before building.

**What this costs.** A second Worker to deploy. Pages keeps three things we are giving up:
per-branch preview URLs, Early Hints, and custom domains on nameservers outside Cloudflare — the
last is irrelevant because the domain is moving to Cloudflare.

**The domain is no longer on the critical path.** The site is reachable at
`dhoa-site.<account>.workers.dev` from the first deploy, which is enough for the board's content
review (`docs/CONTENT-REVIEW.md`). The custom domain is added on top whenever the transfer
completes. Until then the `SITE_URL` repository variable holds the workers.dev address so canonical
URLs and the feeds point at where the site really is; delete the variable at the cutover.

## 6. The mockup's content is the baseline

**Decision.** Where the mockup and the live Google Site disagree, the new site uses the mockup's
value. Every fact still needs board review before launch; see `docs/CONTENT-REVIEW.md`.

## 7. Google sign-in only, with no passwords

**Decision.** People sign in to the admin app with Google. Nobody can sign up. An administrator
invites a person by email, and that person's first Google sign-in with the same address links to
the invitation. Emailed one-time codes may be added later for people without a Google account.

**A correction, 2026-09-17.** This decision was argued from "password hashing costs 20 to 230 ms
and the Workers Free plan allows 10 ms per request". The first half is right; the implied
contrast is not. Measured on the deployed Worker, the Google callback costs about 24 ms of CPU —
inside the range this decision rejected — and 19% of all requests exceed 10 ms without a single
one being terminated. The decision stands, on the grounds that nobody stores a password and
nobody manages one. The CPU headroom argument does not, and should not be quoted again without
re-measuring. See RUNBOOK-admin.md step 7.

**Why.** The association stays on free plans. Storing passwords safely means a deliberately slow
hash. Measured on a 13th-gen Intel i5:

| Hash                           | Time   |
| ------------------------------ | ------ |
| scrypt, N=2^14, r=8            | 23 ms  |
| Better Auth's default scrypt   | 55 ms  |
| PBKDF2-SHA256, 600k iterations | 65 ms  |
| OWASP's recommended scrypt     | 230 ms |

The Workers Free plan allows 10 ms of CPU per request, so password sign-in would fail. Google also
handles two-factor authentication and account recovery, which the app would otherwise have to
build.

**Revisit if** a volunteer cannot use Google. Add Better Auth's email OTP plugin; it needs a
transactional email sender, but no password hashing.

## 8. The Worker's business rules are tested inside the Workers runtime

The admin API runs its tests with `@cloudflare/vitest-pool-workers` against a local D1 database with
the real migrations applied. Only sign-in is replaced by a test header. That package requires
Vitest 4, so `apps/admin` uses Vitest 4 while `packages/shared` uses Vitest 5.

## 9. People are never deleted

**Decision.** Removing someone's access does three things: it revokes their roles, ends their
sessions, and records them as a former member. Their account row is kept.

**Why.** The minutes process is a record: who drafted a version, who commented, who confirmed they
had read it. Deleting a person would blank their name on all of it. History has to show clearly
what a former member did.

**Consequence.** An invitation for a former member's email is refused with a pointer to Restore
access, so there is only ever one record per person.

## 10. Latest versions, with a 24-hour quarantine and two exceptions

**Decision.** Tools and dependencies track their latest releases, pinned exactly: `mise.toml` for
Node, pnpm and just; lockfile and exact versions for packages. Dependabot proposes updates weekly.

- **pnpm's 24-hour release-age rule stays on.** A package published less than a day ago is refused,
  because hijacked releases are usually caught within hours. When we adopt something inside that
  window on purpose, its exact version goes in `minimumReleaseAgeExclude`.
- **Node stays on the active LTS line** (24.x). Node 26 becomes LTS in October 2026.
- **TypeScript 7** is used by `apps/admin` and `packages/shared`. The two Astro apps stay on
  TypeScript 6, because `astro check` (`@astrojs/check` 0.9.10) refuses TypeScript 7.
- **Vitest 5** is used by `packages/shared`. `apps/admin` stays on Vitest 4, because
  `@cloudflare/vitest-pool-workers` 0.22.0 supports only Vitest 4.
- **The Worker's `compatibility_date`** is 2026-08-15, the newest date the test runtime supports.

**Revisit** each exception when its blocker ships a release that supports the newer version.

## 11. The admin app is the single source of truth; the site builds from a snapshot

**Decision.** Every fact and every piece of text on the public site lives in the admin app's
database. The site builds from `apps/site/content/site.json`, a snapshot of what the admin API
publishes (`just snapshot`), which is committed.

**Why.** Volunteers edit in one place with one set of rules (roles, approval, dates). The site
stays a pile of static files that costs nothing to serve and never depends on the Worker being up.
Git keeps a history of everything that was published. Draft or pending content never reaches the
repository because the public endpoint never returns it.

**Consequence.** Content changes reach the site when it rebuilds: on request from the Worker (once
a GitHub App is configured), and every morning by schedule, which also applies publish and expiry
dates. A private repository would burn about 120 Actions minutes a month on this; the repository
is public, so it is free.

## 12. Uploaded files live in Workers KV

**Decision.** PDFs and images uploaded through the admin app are stored in a KV namespace, listed
in D1, and copied into the site at snapshot time so the public site serves them as ordinary files.

**Why.** KV is included in the Workers Free plan with no payment method: 1 GB of storage, values up
to 25 MiB, 1,000 writes and 100,000 reads a day. D1 caps a single row at 2 MB, which a scanned
form exceeds. R2 needs a card on the account. Uploads are rare (a few a month) and public reads
come from the static site, not from KV.

**Revisit if** the association adds a card for the domain transfer and wants direct public file
URLs; R2 then replaces KV with the same `files` table.

## 13. No Queues

**Decision.** Nothing uses Cloudflare Queues.

**Why.** Queues has a free allowance (10,000 operations a day), but every job here is small and
synchronous: a publish is one D1 batch and one GitHub request; expiry is a daily cron trigger,
which is also free. A queue would add a moving part with no work to do.

## 14. Approval is by kind, and never by the author

**Decision.** Site settings say which kinds of item need approval (default: news, documents and
pages). Editors always submit. Anyone with the admin, secretary or board role may approve, except
the person who submitted. Events do not need approval by default because they are time-boxed and
low-risk.

**Why.** The board asked for approval on some content without a vote on everything. Kind-level
switches keep the rule understandable, and the "not your own" rule is what makes approval mean
something.

## 15. People on the roster are never deleted

**Decision.** Directors and committee members are records with a start and a leaving date. Ending
a term is the only way to remove someone, and past members can be shown.

**Why.** Minutes name people. The board page and committee pages come from the roster, and so does
the attendance list in minutes. Names in minutes are stored as text at the time, so an approved
record never changes when the roster does.

## 16. The public snapshot is cached, and every content change clears it

**Decision.** `/api/public/site.json` is held in the Cloudflare edge cache. Every change to
published content clears the entry, in `createApp`, before the site rebuild is requested.

**Why.** The endpoint builds the whole site in one request — five queries and the serialisation of
every published item — and measured 22 to 35 ms of CPU against a 10 ms limit. It is called by the
site build, not by residents, so the cost is small in aggregate, but it was the largest warm
number on the Worker.

**What makes it safe.** Caching a snapshot is only worth doing if it cannot be stale: the site
build runs moments after a publish, so a stale entry would rebuild the public site from its
previous state. Clearing on every content change is what prevents that, and
`settings-roster-files.test.ts` pins it down by editing through a route and reading the snapshot
back.

**The awkward part.** The cache is injected rather than reached for directly, because
`caches.default.delete()` never settles when called from inside a request handler under the
Workers test harness. Production uses the edge cache; the tests pass an in-memory stand-in with
the same contract. A cache hit is also copied into a new Response before being returned — a
response from the cache has immutable headers, and the `secureHeaders` middleware writes to them
on the way out, so returning the cache's own object turns every hit into a 500.
