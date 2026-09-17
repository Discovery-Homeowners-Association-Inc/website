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

2. Start the Worker: `just run-admin`. It listens on all interfaces, port 8787. After changing
   anything in `apps/admin-ui`, stop it and run it again: the UI is served from a build, and
   rebuilding replaces the folder the running server is watching.

3. Create the first administrator in the local database (once):

   ```bash
   xh POST http://desktop:8787/api/bootstrap "authorization:Bearer <BOOTSTRAP_TOKEN>" \
     email=you@example.com name="Your Name"
   ```

4. Open `http://desktop:8787/`. Use **Developer sign-in** with that email.

Developer sign-in exists only when `DEV_SIGN_IN=true` **and** the app runs over plain http. It
cannot be turned on in production, which is served over https.

## First deployment (not done yet)

Everything here stays on the Workers Free plan.

1. **Create the database.** Run `pnpm exec wrangler d1 create dhoa` in `apps/admin`. Put the
   printed `database_id` in `wrangler.jsonc`.
2. **Apply migrations:** `pnpm exec wrangler d1 migrations apply dhoa --remote`.
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
5. **Deploy:** `pnpm --filter @dhoa/admin-ui build`, then `pnpm exec wrangler deploy` in
   `apps/admin`.
6. **Create the first administrator.** Call `/api/bootstrap` as shown above against the
   `workers.dev` address. Then run `wrangler secret delete BOOTSTRAP_TOKEN`. Once an administrator
   exists the endpoint refuses anyway, and deleting the secret removes it entirely.
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

- Publishing an agenda marks it published in the database. It does not yet update the public
  website; that needs a GitHub App to commit the agenda to the site.
- Emailed one-time sign-in codes, for people without a Google account.
- Editing public site content (news, events, documents) from the admin app.
