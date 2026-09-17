# Runbook: the admin app

The admin app is one Cloudflare Worker, `dhoa-admin`. It serves the admin screens as static files
from `apps/admin-ui` and the API under `/api/` from `apps/admin`. Data lives in the D1 database
`dhoa`.

## Run it locally

1. Create `apps/admin/.dev.vars` (it is git-ignored):

   ```ini
   BETTER_AUTH_URL=http://desktop:8787
   BETTER_AUTH_SECRET=<openssl rand -hex 32>
   GOOGLE_CLIENT_ID=
   GOOGLE_CLIENT_SECRET=
   DEV_SIGN_IN=true
   BOOTSTRAP_TOKEN=<openssl rand -hex 24>
   ```

   `BETTER_AUTH_URL` must be the exact address you open in the browser. Sign-in checks the
   request's origin against it.

2. Start the Worker: `just run-admin`. It listens on all interfaces, port 8787. It serves the UI
   from its own build folder (`apps/admin-ui/.dev-dist`), so running `just build` or `just ci`
   does not disturb it. After changing anything in `apps/admin-ui`, stop it and run it again to
   see the change.

3. Create the first administrator in the local database (once):

   ```bash
   xh POST http://desktop:8787/api/bootstrap "authorization:Bearer <BOOTSTRAP_TOKEN>" \
     email=you@example.com name="Your Name"
   ```

4. Open `http://desktop:8787/`. Use **Developer sign-in** with that email.

Developer sign-in exists only when `DEV_SIGN_IN=true` **and** the app runs over plain http. It
cannot be turned on in production, which is served over https.

## Content: seed, snapshot, rebuild

- `just seed-local` fills the local database with the site's starting content (idempotent).
- `just snapshot` saves what the admin app currently publishes into `apps/site/content/` and
  `apps/site/public/documents/`. Commit the result; the site builds from it.
- The Site workflow rebuilds every morning at 10:15 UTC and whenever the Worker sends a
  `repository_dispatch` (only after a GitHub App is configured; see below). Set the repository
  variable `SITE_CONTENT_URL` to the Worker's address (for example
  `https://dhoa-admin.discoveryhomeownersassociation.workers.dev`) so the workflow fetches the
  latest content instead of using the committed snapshot.

### The GitHub App that asks for rebuilds (optional)

Create a GitHub App owned by the organization with only **Contents: Read and write** on this
repository, install it on the repository, and set these Worker secrets: `GITHUB_APP_ID`,
`GITHUB_APP_INSTALLATION_ID`, `GITHUB_APP_PRIVATE_KEY` (the PEM file's contents). Until then the
daily build picks up changes.

## First deployment (done 2026-09-17, except Google sign-in)

Everything here stays on the Workers Free plan.

1. **The database and file store exist.** D1 `dhoa` and KV namespace `FILES` were created on
   2026-09-17; their ids are in `wrangler.jsonc`.
2. **Apply migrations and seed:** in `apps/admin`, `pnpm exec wrangler d1 migrations apply dhoa
--remote`, `node scripts/seed.ts`, `pnpm exec wrangler d1 execute dhoa --remote --file
seed/seed.sql`, then `bash seed/kv.sh --remote`.
3. **Create the Google OAuth client.** Use a Google Cloud project owned by the association's
   Google account (APIs & Services, then Credentials, then OAuth client ID, type **Web
   application**).
   - Authorized JavaScript origin: `https://dhoa-admin.discoveryhomeownersassociation.workers.dev`
   - Authorized redirect URI: `https://dhoa-admin.discoveryhomeownersassociation.workers.dev/api/auth/callback/google`
   - OAuth consent screen: External, **In production**. The app asks only for the basic email and profile scopes, which normally do
     not need Google verification. Adding a logo can trigger a brand review.
4. **Set the variables and secrets:**
   - In `wrangler.jsonc`, set `vars.BETTER_AUTH_URL` to
     `https://dhoa-admin.discoveryhomeownersassociation.workers.dev`.
   - Run `pnpm exec wrangler secret put` for each of `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`,
     `GOOGLE_CLIENT_SECRET` and `BOOTSTRAP_TOKEN`.
   - **Never set `DEV_SIGN_IN` in production.**
5. **Deploy:** the Deploy admin workflow does this on every push to `main`. It needs the
   repository secret `CLOUDFLARE_API_TOKEN` and the variable `CLOUDFLARE_ACCOUNT_ID`. By hand:
   `pnpm --filter @dhoa/admin-ui build`, then `pnpm exec wrangler deploy` in `apps/admin`.
6. **Create the first administrator.** Done: napalm255@gmail.com is the first administrator, and
   `BOOTSTRAP_TOKEN` has been deleted from the Worker. To do it again on a fresh database, set the
   secret, call `/api/bootstrap` as shown above against the `workers.dev` address, then delete the
   secret.
7. **Check CPU use.** Sign in with Google, then open Workers & Pages, then `dhoa-admin`, then
   Metrics. Confirm CPU time per request stays under 10 ms. The only heavy step is sign-in, and it
   has no password hashing.

When the domain moves to Cloudflare, add `admin.discoveryhomeowners.com` as a custom domain on the
Worker. Update `BETTER_AUTH_URL` and add the new origin and redirect URI to the Google client.

## Everyday tasks

- **Add a board member:** People, then Invite. They sign in with Google using exactly that
  address. If they use a different Google address, they see "has not been invited".
- **Someone leaves the board:** People, then Remove access. Their sessions end immediately and
  they cannot sign in. They are kept as a **former member**: their name stays on every comment,
  version, and review mark, shown as "Name (former member)". To bring them back, Restore access
  under Former members.
- **Minutes for a meeting:**
  1. Meetings, pick the meeting, then Minutes for this meeting, then Start minutes from the agenda.
  2. Save versions as you go, then Send for review.
  3. Board members comment and mark the version reviewed.
  4. Before the meeting, Ready for a vote.
  5. At the meeting, record the vote. The vote applies only to the latest version; if anyone saves
     after a board member opened the page, that person is asked to reload.
  6. Afterwards, Export PDF. In the print dialog choose Save as PDF, upload the file to PayHOA,
     then Mark as uploaded to PayHOA.

## What is not built yet

- Emailed one-time sign-in codes, for people without a Google account.
- The Sender.net newsletter.
- Deploying the public site itself (GitHub Pages or Workers Static Assets) waits on the domain.
