-- One number that changes whenever anything the public site shows changes.
-- The public snapshot's cache key carries it, so a stale entry can never be
-- served: any write that bumps it makes the next request miss. Writes that
-- bypass the Worker -- the seed, the deploy's settings.sql -- bump it too.
create table site_version (
  id         integer primary key check (id = 1),
  version    integer not null default 0,
  changed_at text not null
);
insert into site_version (id, version, changed_at)
  values (1, 0, '2026-09-18T00:00:00.000Z');
