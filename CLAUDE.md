# Working in this repository

Read `docs/DECISIONS.md` before changing architecture, and `SECURITY.md` before touching
credentials or workflows.

## Never commit a secret

This is a public repository. Credentials go in Worker secrets or in the git-ignored
`.env` / `apps/admin/.dev.vars`, never in source, tests, fixtures, docs, or commit messages.
Run `just security` before every commit; CI runs it too. Test fixtures use obviously fake
values and are allowlisted in `.gitleaks.toml`.

## Stay on free plans

Workers Free (10 ms CPU per request), D1, KV and GitHub Actions on a public repo. Keep
CPU-heavy work (PDF rendering, hashing) in the browser. Any change that would need a paid plan
must say so and justify it in `docs/DECISIONS.md`.

## Commands

`just setup`, `just ci` (everything CI runs), `just run` (public site), `just run-admin`
(admin app). See `docs/RUNBOOK-admin.md`.
