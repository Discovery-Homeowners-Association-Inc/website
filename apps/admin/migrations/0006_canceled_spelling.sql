-- "canceled", not "cancelled": this project writes American English.
--
-- The value is inside a check constraint, and SQLite can only change one by
-- rebuilding the table. Dropping `meetings` fires `on delete cascade` into the
-- six tables that reference it -- agendas, agenda_versions, minutes,
-- minutes_versions, review_comments and votes -- and takes the association's
-- records with it. Measured, not assumed: a plain rebuild emptied all of them,
-- and neither `PRAGMA foreign_keys = OFF` nor `defer_foreign_keys` prevented it
-- under D1.
--
-- So each child is held in a copy across the rebuild and put back afterwards.
create table agendas_keep as select * from agendas;
create table agenda_versions_keep as select * from agenda_versions;
create table minutes_keep as select * from minutes;
create table minutes_versions_keep as select * from minutes_versions;
create table review_comments_keep as select * from review_comments;
create table votes_keep as select * from votes;

create table meetings_new (
  id         text not null primary key,
  type       text not null check (type in ('board', 'annual', 'special', 'pool-rec')),
  date       text not null check (date glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  time       text not null,
  location   text not null,
  status     text not null default 'scheduled' check (status in ('scheduled', 'canceled', 'held')),
  created_by text references "user" ("id") on delete set null,
  created_at text not null,
  unique (type, date)
);
insert into meetings_new (id, type, date, time, location, status, created_by, created_at)
  select id, type, date, time, location,
         case status when 'cancelled' then 'canceled' else status end,
         created_by, created_at
    from meetings;

drop table meetings;
alter table meetings_new rename to meetings;

insert into agendas select * from agendas_keep;
insert into agenda_versions select * from agenda_versions_keep;
insert into minutes select * from minutes_keep;
insert into minutes_versions select * from minutes_versions_keep;
insert into review_comments select * from review_comments_keep;
insert into votes select * from votes_keep;

drop table agendas_keep;
drop table agenda_versions_keep;
drop table minutes_keep;
drop table minutes_versions_keep;
drop table review_comments_keep;
drop table votes_keep;
