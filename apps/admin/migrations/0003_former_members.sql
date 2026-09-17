-- People are never deleted. Removing someone's access records them here, so
-- everything they wrote, reviewed, or voted on keeps their name.
create table former_members (
  user_id    text not null primary key references "user" ("id"),
  removed_at text not null,
  removed_by text references "user" ("id"),
  note       text not null default ''
);
