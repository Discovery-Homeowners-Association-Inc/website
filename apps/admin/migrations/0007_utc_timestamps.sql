-- Item timestamps are compared as text, so every stored value must be in the
-- same form. Rows written before the API normalized its input carry offsets.
-- SQLite's strftime reads an ISO string with an offset and gives UTC back.
update items
   set publish_at = strftime('%Y-%m-%dT%H:%M:%fZ', publish_at)
 where publish_at not like '%Z';
update items
   set expires_at = strftime('%Y-%m-%dT%H:%M:%fZ', expires_at)
 where expires_at is not null and expires_at not like '%Z';
