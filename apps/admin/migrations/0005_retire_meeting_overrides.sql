-- Meeting exceptions were a list in settings, while the meetings table already
-- had a status of its own. Two places to cancel one meeting. The board's
-- schedule now produces meeting records, and a meeting is cancelled or moved by
-- editing the record, so the setting has nowhere left to be read from.
delete from settings where key = 'meeting-overrides';
