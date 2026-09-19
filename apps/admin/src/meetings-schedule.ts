import { occurrences, todayInNewYork } from "@dhoa/shared";
import { readSetting } from "./routes/settings.ts";

/** How far ahead meetings are kept as records. */
export const HORIZON_MONTHS = 12;

/**
 * Turns the board's meeting rule into records.
 *
 * The site used to generate its upcoming list from the rule while the admin app
 * listed records, so the two could not agree: the site advertised meetings that
 * did not exist, and an agenda had nothing to attach to. The rule now produces
 * the records, and the records are what everything reads.
 *
 * The id is the schedule -- `2026-09-15-board` -- so a meeting the rule has
 * already produced is recognized rather than written twice. `insert or ignore`
 * therefore leaves every existing row exactly as it is, which is what lets the
 * board cancel or move a meeting without the next run undoing it.
 */
export async function materializeMeetings(
  db: D1Database,
  now = new Date(),
  months = HORIZON_MONTHS,
): Promise<{ created: number }> {
  const board = (await readSetting(db, "organization")).meetings.board;
  const wanted = occurrences(
    { ordinal: board.ordinal, weekday: board.weekday },
    todayInNewYork(now),
    months,
  );
  if (wanted.length === 0) return { created: 0 };

  const results = await db.batch(
    wanted.map((o) =>
      db
        .prepare(
          `insert or ignore into meetings (id, type, date, time, location, created_by, created_at)
           values (?, 'board', ?, ?, ?, null, ?)`,
        )
        .bind(
          `${o.date}-board`,
          o.date,
          board.time,
          board.location,
          now.toISOString(),
        ),
    ),
  );
  return {
    created: results.reduce((n, r) => n + (r.meta?.changes ?? 0), 0),
  };
}

/**
 * After the rule changes. Future meetings the rule made -- created by nobody,
 * still on the date their id records, with no agenda and no minutes -- are
 * dropped and the rule fills the year again. A meeting someone moved, or one
 * with work attached, is the board's and is left exactly where it is.
 */
export async function reconcileMeetings(
  db: D1Database,
  now = new Date(),
): Promise<{ created: number; removed: number }> {
  const removed = await db
    .prepare(
      `delete from meetings
        where type = 'board' and created_by is null and status = 'scheduled'
          and date >= ? and date = substr(id, 1, 10)
          and id not in (select meeting_id from agendas)
          and id not in (select meeting_id from minutes)`,
    )
    .bind(todayInNewYork(now))
    .run();
  const { created } = await materializeMeetings(db, now);
  return { created, removed: removed.meta.changes ?? 0 };
}
