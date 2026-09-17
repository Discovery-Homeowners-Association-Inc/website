# Content administration: design

Goal: board members and volunteers with no technical background manage everything on the public
site from the admin app, on a phone or a desktop, with approval where it matters, and with the
association staying on free plans.

## What people can do

| Role      | Can                                                                         |
| --------- | --------------------------------------------------------------------------- |
| admin     | Everything below, plus invite people, set roles, and change site settings   |
| secretary | Meetings, agendas, minutes; approve content; edit the roster and committees |
| board     | Review and vote on minutes; approve content                                 |
| editor    | Write news, events, documents and page text; submit for approval            |
| reviewer  | Read draft minutes and comment                                              |

Every role can edit their own profile (name) and sign out of other devices.

## Content

Two kinds of content:

- **Items** (many of a kind): news, events, documents, pages, meetings. Each item has a status, a
  publish date and an optional expiry.
- **Settings** (one of a kind): the organization's contact details and dues, the pool, the
  Recreation Center, the RV lot, parks, trash and recycling, "who to call", community links,
  projects, and the Architectural Control page's lists.

Plus the **roster**: people who serve on the board and committees, with terms, separate from
sign-in accounts. A director need not have a login.

### Item lifecycle

```
draft ──submit──▶ pending ──approve──▶ published
  ▲                  │ reject (with a note)
  └──────────────────┘
```

- Site settings say which item kinds need approval (default: news, documents and pages do; events
  and meetings do not). An `editor` always submits. An admin or secretary can publish directly
  when approval is not required.
- Approvers are admin, secretary and board. Nobody approves their own submission.
- **Visible on the site** means: published, `publish_at` has passed, and `expires_at` has not.
- `expiry_action` is `hide` (default) or `delete`. A daily job in the Worker deletes expired items
  marked `delete`. Everything else is kept.
- Every change writes the audit log.

### Roster and minutes

Minutes name people from the roster: attendance is a checklist of current directors, and
"presiding", "recorded by", "moved by" and "seconded by" are pickers with a "someone else" option.
Names are stored as text in the minutes, so a person leaving the board later never changes an
approved record.

## Publishing to the public site

The public site stays static and free. The admin API is the single source of truth.

1. `GET /api/public/site.json` returns everything currently visible: items, settings, roster,
   committees and meetings with published agendas. No sign-in.
2. `just snapshot` saves that JSON and the document files into `apps/site/content/`, which is
   committed. The site builds only from the snapshot, so the build never depends on the Worker
   being up, and git keeps a history of what was published.
3. When content is published, the Worker asks GitHub to rebuild (a `repository_dispatch` through
   a GitHub App). Until the App exists, publishing marks the item and the daily scheduled build
   picks it up. The daily build also handles publish and expiry dates.

Document files are uploaded through the admin app into **Workers KV** and served from the site
as ordinary files after a snapshot.

## Technology decisions (evidence in docs/DECISIONS.md)

| Choice                        | Decision                                                  | Why                                                                                                                 |
| ----------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Workers KV for uploaded files | Yes                                                       | Free plan: 1 GB, 25 MiB values, 1,000 writes/day. D1 rows max 2 MB, so a scanned PDF does not fit. R2 needs a card. |
| Queues                        | No                                                        | Free plan includes 10,000 operations/day, but nothing here is asynchronous. A cron trigger (free) handles expiry.   |
| Daily site rebuild            | GitHub Actions schedule                                   | About 4 minutes a day, well inside the 2,000 free minutes a private repo gets.                                      |
| Rich text                     | Plain text with paragraphs, plus optional simple Markdown | A rich editor is the largest, most fragile part of any CMS. Board notices are paragraphs and links.                 |

## Admin app screens

- **Home**: what needs you (approvals, minutes to review, items to file), then what is coming up.
- **News, Events, Documents, Pages**: a list with status badges and a search box; one editor form
  per kind. Every field has a label and a short explanation.
- **Meetings**: as today, with roster pickers in minutes.
- **People**: the roster (directors, committee members) and, for admins, sign-in accounts.
- **Site settings** (admin): one form per settings group.
- **Profile**: your name and your other sessions.
- **Help**: task guides in plain language, linked from every screen with a "Need help?" link.

Every form works one-handed on a phone. Every action has a plain-English name, and a message says
what happened. Nothing destructive happens without a confirmation that says what will be lost.

## Testing

- Shared schemas: unit tests for visibility rules and the approval state machine.
- Worker: integration tests in the Workers runtime for every route, role and transition, expiry
  job, and the public endpoint never leaking drafts.
- Admin UI: browser tests following an editor submitting, a director approving, a scheduled post
  appearing, and an expired one disappearing; phone-width and axe checks on every screen.
- Public site: existing tests, now built from the snapshot.
