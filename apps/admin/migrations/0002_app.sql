-- Roles, meetings, agendas, minutes and their review trail.
-- Timestamps are ISO 8601 UTC strings. Meeting dates are YYYY-MM-DD in New York.

create table user_roles (
  user_id    text not null references "user" ("id") on delete cascade,
  role       text not null check (role in ('admin', 'secretary', 'board', 'editor', 'reviewer')),
  scope      text not null default '',
  granted_by text references "user" ("id") on delete set null,
  granted_at text not null,
  primary key (user_id, role, scope)
);

create table audit_log (
  id        integer primary key autoincrement,
  at        text not null,
  actor_id  text references "user" ("id") on delete set null,
  action    text not null,
  entity    text not null,
  entity_id text not null,
  detail    text
);
create index audit_log_entity_idx on audit_log (entity, entity_id);

create table meetings (
  id         text not null primary key,
  type       text not null check (type in ('board', 'annual', 'special', 'pool-rec')),
  date       text not null check (date glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  time       text not null,
  location   text not null,
  status     text not null default 'scheduled' check (status in ('scheduled', 'cancelled', 'held')),
  created_by text references "user" ("id") on delete set null,
  created_at text not null,
  unique (type, date)
);

-- Agendas are public once published; each save is a new immutable version.
create table agendas (
  meeting_id        text not null primary key references meetings (id) on delete cascade,
  status            text not null default 'draft' check (status in ('draft', 'published')),
  current_version   integer not null default 0,
  published_version integer,
  published_at      text,
  published_by      text references "user" ("id") on delete set null
);

create table agenda_versions (
  meeting_id text not null references meetings (id) on delete cascade,
  version    integer not null,
  body       text not null,
  author_id  text references "user" ("id") on delete set null,
  created_at text not null,
  primary key (meeting_id, version)
);

-- Minutes never leave this database except as an approved PDF export for PayHOA.
create table minutes (
  meeting_id      text not null primary key references meetings (id) on delete cascade,
  status          text not null default 'draft' check (status in ('draft', 'in_review', 'ready_for_vote', 'approved', 'filed')),
  current_version integer not null default 0,
  filed_at        text,
  filed_by        text references "user" ("id") on delete set null,
  filed_note      text
);

create table minutes_versions (
  meeting_id  text not null references meetings (id) on delete cascade,
  version     integer not null,
  body        text not null,
  sha256      text not null,
  change_note text,
  author_id   text references "user" ("id") on delete set null,
  created_at  text not null,
  primary key (meeting_id, version)
);

create table review_comments (
  id          text not null primary key,
  meeting_id  text not null references meetings (id) on delete cascade,
  version     integer not null,
  anchor      text not null default '',
  body        text not null,
  author_id   text references "user" ("id") on delete set null,
  created_at  text not null,
  resolved_at text,
  resolved_by text references "user" ("id") on delete set null
);
create index review_comments_meeting_idx on review_comments (meeting_id);

-- A board member's mark that they have read a specific version.
create table reviews (
  meeting_id  text not null references meetings (id) on delete cascade,
  version     integer not null,
  user_id     text not null references "user" ("id") on delete cascade,
  reviewed_at text not null,
  primary key (meeting_id, version, user_id)
);

-- The vote binds to one exact version by hash. Export refuses anything else.
create table votes (
  meeting_id  text not null primary key references minutes (meeting_id) on delete cascade,
  version     integer not null,
  sha256      text not null,
  voted_on    text not null,
  motion_by   text not null,
  seconded_by text not null,
  yes         integer not null check (yes >= 0),
  no          integer not null check (no >= 0),
  abstain     integer not null check (abstain >= 0),
  recorded_by text references "user" ("id") on delete set null,
  recorded_at text not null
);
