-- Site content: items (news, events, documents, pages), settings, the roster,
-- committees, and uploaded files. Bodies are JSON validated by @dhoa/shared.

create table items (
  id            text not null primary key,
  kind          text not null check (kind in ('news', 'event', 'document', 'page')),
  slug          text not null,
  status        text not null default 'draft' check (status in ('draft', 'pending', 'published')),
  body          text not null,
  publish_at    text not null,
  expires_at    text,
  expiry_action text not null default 'hide' check (expiry_action in ('hide', 'delete')),
  author_id     text references "user" ("id"),
  submitted_by  text references "user" ("id"),
  submitted_at  text,
  approved_by   text references "user" ("id"),
  approved_at   text,
  review_note   text not null default '',
  created_at    text not null,
  updated_at    text not null,
  unique (kind, slug)
);
create index items_kind_status_idx on items (kind, status, publish_at);

create table settings (
  key        text not null primary key,
  value      text not null,
  updated_by text references "user" ("id"),
  updated_at text not null
);

create table people (
  id         text not null primary key,
  data       text not null,
  created_at text not null,
  updated_at text not null
);

create table committees (
  slug       text not null primary key,
  data       text not null,
  updated_at text not null
);

-- Uploaded files. The bytes live in Workers KV under the same id; this row
-- is what lists, names and secures them.
create table files (
  id           text not null primary key,
  name         text not null,
  content_type text not null,
  size         integer not null,
  sha256       text not null,
  uploaded_by  text references "user" ("id"),
  uploaded_at  text not null
);
