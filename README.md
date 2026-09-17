# Discovery Homeowners Association website

The public website and admin app for the Discovery Homeowners Association, Inc., in
Walkersville, Maryland.

> **Not published yet.** The association's current site is still the Google Site. This
> repository replaces both it and the earlier Hugo mockup.

## What is here

| Path                     | What it is                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------ |
| `apps/site`              | The public site: static Astro, no server                                                   |
| `packages/shared`        | Rules shared by the site and the admin app: the minutes lifecycle and the meeting schedule |
| `docs/DESIGN.md`         | The visual design and why                                                                  |
| `docs/CONTENT-REVIEW.md` | Content the board needs to confirm before launch                                           |

The admin API is built and tested. Its user interface, and deployment to Cloudflare, are next.

## Develop

You need [mise](https://mise.jdx.dev/) and [just](https://just.systems/).

```bash
just setup   # install Node, pnpm and dependencies
just run     # dev server on http://0.0.0.0:4321, reachable from other devices
just ci      # everything CI runs: format check, typecheck, tests, audit, build
```

Secrets go in `.env`, which is ignored. See `.env.example`.

## Editing content

Until the admin app exists, content is edited in the repository:

- Organizational facts (phone, hours, dues, board, committees) are in `apps/site/src/data/*.json`. The build fails if a required value is missing.
- Page text is Markdown in `apps/site/src/content/pages/`. Write `{{email:general}}` or `{{phone:office}}` instead of typing an address or number.
- News, events and documents each have a folder under `apps/site/src/content/`.
