-- Item timestamps are compared as text, so every stored value must be in the
-- same form. Rows written before the API normalized its input carry offsets.
-- SQLite's strftime reads an ISO string with an offset and gives UTC back.
-- coalesce falls back to the original value when strftime cannot parse a row,
-- so one unparseable timestamp cannot abort the whole deploy.
update items
   set publish_at = coalesce(strftime('%Y-%m-%dT%H:%M:%fZ', publish_at), publish_at)
 where publish_at not like '%Z';
update items
   set expires_at = coalesce(strftime('%Y-%m-%dT%H:%M:%fZ', expires_at), expires_at)
 where expires_at is not null and expires_at not like '%Z';
