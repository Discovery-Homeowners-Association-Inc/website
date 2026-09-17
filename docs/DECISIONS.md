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

## 5. Hosting the public site: not yet decided

GitHub Pages (the stated preference) and Cloudflare Workers Static Assets both serve static files
for free, and the build output works on either.

- **Workers Static Assets:** HTTPS can be validated all the way to the origin (Full (strict)), and
  everything lives on one platform.
- **GitHub Pages behind the Cloudflare proxy:** the Cloudflare-to-GitHub hop cannot be validated
  (see the mockup's decision #6).

Decide before the domain cutover.

## 6. The mockup's content is the baseline

**Decision.** Where the mockup and the live Google Site disagree, the new site uses the mockup's
value. Every fact still needs board review before launch; see `docs/CONTENT-REVIEW.md`.

## 7. Google sign-in only, with no passwords

**Decision.** People sign in to the admin app with Google. Nobody can sign up. An administrator
invites a person by email, and that person's first Google sign-in with the same address links to
the invitation. Emailed one-time codes may be added later for people without a Google account.

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
