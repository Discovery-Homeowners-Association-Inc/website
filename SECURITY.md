# Security

## Reporting a problem

If you find a security problem in this website or its administration app, please report it
privately through GitHub's private vulnerability reporting for this repository, or email the
association office (the address is on the website's contact page). Please do not open a public
issue for a security problem.

## Secrets never go in this repository

This repository is public. Nothing in it is secret, and nothing secret may be added to it:

- Credentials live in Cloudflare Worker secrets (`wrangler secret put`) and, locally, in
  `apps/admin/.dev.vars` and `.env`, both of which git ignores.
- Every commit is checked by gitleaks locally (`just security`) and in CI, and GitHub's push
  protection blocks known secret formats before they land.
- If a secret is ever committed, rotate it immediately. Removing it from history does not undo
  the exposure.

## What runs on every change

- **gitleaks**: secrets in the working tree and in git history.
- **osv-scanner**: known vulnerabilities in every dependency in the lockfile.
- **zizmor** and **actionlint**: GitHub Actions workflow problems.
- **CodeQL**: GitHub's code scanning for JavaScript and TypeScript.
- **Dependabot**: weekly dependency and Actions updates, plus security alerts.

## How the application protects itself

- Sign-in is Google only, invite-only, and the admin app never stores passwords.
- Every API route requires a signed-in account with a role; routes that change data check the
  specific role, and reading routes give each role what it needs (an editor never sees draft
  minutes). Draft minutes never leave the database except as an approved PDF.
- Every change to data writes an audit log entry in the same database transaction.
- The public website is static files; visitors never reach the database.
