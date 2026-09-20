# The admin app

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

   `BETTER_AUTH_URL` must be the hostname you open in the browser, for example
   `http://desktop:8787`. Sign-in checks the request's origin against it.

2. Start the Worker: `just run-admin`. It listens on all interfaces, port 8787. It serves the UI
   from its own build folder (`apps/admin-ui/.dev-dist`), so running `just build` or `just ci`
   does not disturb it. After changing anything in `apps/admin-ui`, stop it and run it again to
   see the change.

3. Create the first administrator in the local database (once):

   ```bash
   xh POST http://desktop:8787/api/bootstrap "authorization:Bearer <BOOTSTRAP_TOKEN>" \
     email=you@example.com name="Your Name"
   ```

4. Open the address from step 1. Use **Developer sign-in** with that email.

If the app answers "Something went wrong on the server" and the server log says `no such table`,
the local database is empty or stale: stop the server, run `just seed-local`, start it again, and
repeat step 3. (Wrangler keeps local data per database id, so changing the id in
`wrangler.jsonc` starts a fresh, empty local database.)

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
- Seeding (locally, or the "Create any settings the database does not have yet" deploy step)
  only inserts settings and page copy the database does not already have (`insert or ignore`),
  and its last statement bumps `site_version`. `/api/public/site.json` is cached under a key
  that carries that number, so a bumped version is a fresh cache key and a build can never read
  a stale snapshot — there is no cache to clear by hand.

### The GitHub App that asks for rebuilds (optional)

Create a GitHub App owned by the organization with only **Contents: Read and write** on this
repository, install it on the repository, and set these Worker secrets: `GITHUB_APP_ID`,
`GITHUB_APP_INSTALLATION_ID`, `GITHUB_APP_PRIVATE_KEY` (the PEM file's contents). Until then the
daily build picks up changes.

## First deployment

Everything here stays on the Workers Free plan. `GITHUB_REPO` and `SITE_URL` are already set as
plain `vars` in `wrangler.jsonc`; they are not secrets and do not need to be set again.

1. **Create the D1 database and the KV namespace**, then put their ids in `wrangler.jsonc`.
2. **Apply migrations and seed:** in `apps/admin`, `pnpm exec wrangler d1 migrations apply dhoa
--remote`, `node scripts/seed.ts`, `pnpm exec wrangler d1 execute dhoa --remote --file
seed/seed.sql`, then `bash seed/kv.sh --remote`. Applying it twice is a no-op: every row is
   keyed on what identifies it (items and committees by slug, people by name), so `insert or
ignore` does what it promises. `just seed-check` runs in CI and fails if an id ever stops
   being stable.
3. **Create a Google OAuth client.** Use a Google Cloud project owned by the association's
   Google account. The console calls this **Google Auth Platform** now, not APIs & Services:
   go straight to <https://console.cloud.google.com/auth/clients> and Create client, type
   **Web application**.
   - Authorized JavaScript origin: the Worker's address (`BETTER_AUTH_URL`).
   - Authorized redirect URI: that address plus `/api/auth/callback/google`.
   - Audience: External. **In production** if you can; while it is left in **Testing**, only
     addresses listed under Test users can sign in at all — everyone else is refused with
     `access_denied`, which looks exactly like a broken configuration — and sessions last 7 days
     regardless of the app's own setting.
   - The app asks only for the basic email and profile scopes, which normally do not need Google
     verification. **Adding a logo triggers a brand review**, so leave it off until you want it.
4. **Set the variables and secrets:**
   - In `wrangler.jsonc`, set `vars.BETTER_AUTH_URL` to the Worker's address.
   - Run `pnpm exec wrangler secret put` for each of `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`,
     `GOOGLE_CLIENT_SECRET` and `BOOTSTRAP_TOKEN`.
   - **Never set `DEV_SIGN_IN` in production.**
5. **Deploy:** the Deploy admin workflow does this on every push to `main`. It needs the
   repository secret `CLOUDFLARE_API_TOKEN` and the variable `CLOUDFLARE_ACCOUNT_ID`. By hand:
   `pnpm --filter @dhoa/admin-ui build`, then `pnpm exec wrangler deploy` in `apps/admin`.
6. **Create the first administrator.** Set the `BOOTSTRAP_TOKEN` secret, call `/api/bootstrap`
   as shown in "Run it locally" against the deployed address, then delete the secret.

When the domain moves to Cloudflare, add `admin.discoveryhomeowners.com` as a custom domain on the
Worker. Update `BETTER_AUTH_URL` and add the new origin and redirect URI to the Google client.

## CPU use

Measured on 2026-09-17, over 172 requests, this does **not** hold as an earlier assumption had
it. The median request costs 4 ms, but 19% exceed the 10 ms Workers Free limit. No request has
ever been terminated: the only invocation status this Worker has ever recorded is `success`, so
enforcement is currently looser than the documented Error 1102 behavior. Two separate causes, and
only one of them is ours:

- **Cold starts dominate the tail.** The same endpoint costs 4 ms warm and 32 ms cold;
  94% of requests following an idle gap exceed 10 ms, against 10% of warm ones. Cloudflare
  documents Worker startup as a separate 1-second limit, which is the likely reason none of
  these are rejected.
- **Two endpoints are over the limit while warm.** `/api/public/site.json` cost 22–35 ms until
  it was cached; `/api/auth/callback/google` costs about 24 ms on every sign-in, measured over
  only three samples. Gather more before optimizing it.

To re-measure, with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in the environment,
query per-request CPU by path from the observability API — the Worker has
`observability.enabled`, and `$workers.cpuTimeMs` with `$workers.event.request.path` is what
the dashboard cannot group for you:

```
POST https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/observability/telemetry/query
{"queryId":"cpu","timeframe":{"from":<ms>,"to":<ms>},
 "parameters":{"datasets":["cloudflare-workers"]},"view":"events","limit":500}
```

Aggregate `$workers.cpuTimeMs` per path yourself; the API's `groupBys` returns nothing useful
for these events.

## What is not built

- Emailed one-time sign-in codes, for people without a Google account.
