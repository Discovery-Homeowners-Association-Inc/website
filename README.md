# Discovery Homeowners Association website

The public website and admin app for the Discovery Homeowners Association, Inc., in
Walkersville, Maryland. Both are live on Cloudflare's free plans:

- Public site: https://dhoa-site.discoveryhomeownersassociation.workers.dev (the
  association's own domain is added when its transfer completes; until then the site is
  kept out of search results).
- Admin app: https://dhoa-admin.discoveryhomeownersassociation.workers.dev (Google sign-in,
  invitation only).

## What is here

| Path              | What it is                                                                         |
| ----------------- | ---------------------------------------------------------------------------------- |
| `apps/site`       | The public site: static Astro, built from a snapshot of published content          |
| `apps/admin`      | The admin API: a Cloudflare Worker over D1 and KV (`apps/admin/README.md`)         |
| `apps/admin-ui`   | The admin screens: Astro with Preact islands, served by the admin Worker           |
| `packages/shared` | Rules and schemas both apps use: content, settings, minutes, the schedule          |
| `packages/design` | Tokens, base stylesheet, fonts and the shared header (`packages/design/README.md`) |
| `scripts`         | The snapshot fetcher and the checks `just ci` runs                                 |

## Develop

You need [mise](https://mise.jdx.dev/) and [just](https://just.systems/).

```bash
just setup       # Node, pnpm, dependencies, browsers
just run         # the public site on http://0.0.0.0:4321
just run-admin   # the admin app on http://0.0.0.0:8787 (see apps/admin/README.md)
just ci          # everything CI runs
```

Secrets go in `.env` and `apps/admin/.dev.vars`, both git-ignored. See `.env.example`.

## How it fits together

Everything a resident reads is edited in the admin app and stored in D1. The public site never
touches the database: it builds from `apps/site/content/site.json`, a snapshot of
`GET /api/public/site.json`, which lists only published items inside their dates, the roster,
committees, settings and meetings with published agendas. Draft or pending content never
reaches the repository.

The site rebuilds every morning at 10:15 UTC (after the Worker's 10:00 job applies publish and
expiry dates), on every push to `main`, and whenever the Worker asks through a
`repository_dispatch` from a GitHub App. The snapshot endpoint is held in Cloudflare's edge
cache under a key that carries `site_version`, a number every change bumps, so a build never
reads a stale snapshot.

### Choices that are expensive to reverse

These were decisions; they are recorded so they are changed on purpose.

- **Free plans only.** Workers Free (10 ms CPU per request), D1, KV, GitHub Actions on a public
  repository. The ceilings are 100,000 Worker requests and 5 million D1 row reads a day; a
  private repository would spend about 120 Actions minutes a month on the daily rebuild, which
  is why this one is public. CPU-heavy work (PDF rendering, the data export) happens in the
  browser. A change that needs a paid plan says so in its PR.
- **The public site is an assets-only Worker.** `apps/site/wrangler.jsonc` has no `main`, so
  no Worker code runs for a page view and static requests are free and unlimited.
- **One language.** Astro and TypeScript for the site, the API and the admin screens, so
  validation and business rules are written once in `packages/shared`.
- **D1 for data, KV for uploaded files.** R2 needs a payment card on the account. KV holds
  values up to 25 MiB; a scanned form exceeds D1's 2 MB row limit. Uploaded files are copied
  into the site at snapshot time and served as ordinary files. R2 replaces KV, with the same
  `files` table, whenever a card goes on the account.
- **Google sign-in only, invitation only.** Nobody stores or manages a password. An
  administrator invites an email address; the first Google sign-in with it links the account.
- **Approved minutes live in PayHOA, not on the website.** The admin app runs the whole
  process (draft, review, vote, an approved version bound to a content hash, filed); the
  secretary uploads the exported PDF to the resident portal by hand.
- **Approval is by kind, never by the author.** Settings say which kinds need a second person
  (news, documents and pages by default). Approval is pinned to the version the approver read.
- **People are never deleted.** Removing access revokes roles and ends sessions; the account
  stays so history keeps its names. Roster members get an end date rather than deletion.
- **Latest versions, pinned exactly, with a 24-hour quarantine.** `mise.toml` and the
  lockfile pin everything; pnpm refuses packages published in the last day. Two exceptions
  hold: the Astro apps stay on TypeScript 6 (`astro check` refuses 7) and the Worker on
  Vitest 4 (`@cloudflare/vitest-pool-workers` supports only 4). Node stays on the active LTS
  line, and the Worker's `compatibility_date` is the newest date
  `@cloudflare/vitest-pool-workers` supports.
- **No Queues, no newsletter.** Every job is small and synchronous; the daily cron is enough.
  The newsletter section was removed on 2026-09-18 because nothing existed for it to post to.

## Deploying

**Site** deploys on every push to `main`; **Deploy admin** deploys when a push to `main` touches
`apps/admin`, `apps/admin-ui`, `packages/` or the lockfile. Deploy admin applies migrations,
then the settings the database is missing, then the Worker. Site waits for the admin deploy of
the same commit, fetches the snapshot from `SITE_CONTENT_URL`, builds and deploys. Both need the
repository secret `CLOUDFLARE_API_TOKEN` and the variable `CLOUDFLARE_ACCOUNT_ID`; the site also
reads the
variables `SITE_URL` (the address it is served at; delete it at the domain cutover) and
`SITE_CONTENT_URL` (the admin Worker's address).

Security: see `SECURITY.md`. Operating the admin Worker, the first-time setup and the CPU
measurements: `apps/admin/README.md`.
