# The public site

Static Astro, built from a snapshot of what the admin app publishes. It never touches D1 or
runs Worker code: `apps/site/wrangler.jsonc` has no `main`.

## The snapshot

`apps/site/content/site.json` is a copy of `GET /api/public/site.json` — the admin Worker's
published news, events, documents, roster, committees, meetings with published agendas, and
site settings. `just snapshot` fetches it and updates that file plus
`apps/site/public/documents/`; commit the result, because the site builds from it, never from
the live Worker directly (except in CI, when `SITE_CONTENT_URL` is set — see
`apps/admin/README.md`).

## Page copy versus settings

Most page text (phone numbers, hours, fees, addresses) lives in **settings**, edited under
Site settings in the admin app. Longer page copy (the prose on pages like About or the
committees page) is its own **page** content, seeded once from `apps/admin/seed` and then
editable in the admin app like anything else.

The two follow different rules on deploy: a page nobody has edited in the admin app still
follows a correction committed to the seed, so a repository fix reaches a site nobody has
touched yet. Settings text never does — once a value exists it is never overwritten, because
the board may have already changed it away from the seed's placeholder.

## Referring to organizational facts from Markdown

Page copy can use three tokens instead of repeating a fact that lives elsewhere, handled by
`apps/site/src/lib/remark-org.ts`:

- `{{email:role}}` — a mailto link to that role's address.
- `{{phone:office}}` — a tel link to the office phone.
- `{{setting:a.b.c}}` — the value at that path in Site settings, as text.

An unknown key throws, so a typo fails the build rather than shipping silently.

## Content the board still needs to confirm

Tracked as a GitHub issue: <https://github.com/Discovery-Homeowners-Association-Inc/website/issues/37>
