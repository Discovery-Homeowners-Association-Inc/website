import { env } from "cloudflare:workers";
import { beforeAll, expect, test } from "vitest";
import { materializeMeetings } from "../src/meetings-schedule.ts";
import { seedSettings } from "./helpers.ts";

/**
 * The board's schedule is a rule -- the third Tuesday of every month -- and the
 * site used to generate dates from it while the admin app listed records. The
 * two could not agree: the site advertised meetings that did not exist, so
 * there was nothing for an agenda to attach to. The rule now produces records,
 * and those records are the only source of truth.
 */
beforeAll(async () => {
  await seedSettings();
});

const boardMeetings = async () => {
  const { results } = await env.DB.prepare(
    "select id, date, status, time, location from meetings where type = 'board' order by date",
  ).all<{
    id: string;
    date: string;
    status: string;
    time: string;
    location: string;
  }>();
  return results;
};

/** The weekday of a YYYY-MM-DD date, 0 = Sunday, read in UTC to avoid drift. */
const weekdayOf = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

test("the rule fills a year of board meetings", async () => {
  const { created } = await materializeMeetings(env.DB, new Date("2026-01-05"));
  expect(created).toBe(12);

  const rows = await boardMeetings();
  expect(rows).toHaveLength(12);
  // The seeded rule is the third Tuesday of every month.
  for (const row of rows) {
    expect(weekdayOf(row.date), `${row.date} is not a Tuesday`).toBe(2);
    const day = Number(row.date.slice(-2));
    expect(day, `${row.date} is not in the third week`).toBeGreaterThanOrEqual(
      15,
    );
    expect(day).toBeLessThanOrEqual(21);
  }
  // Time and location come from the rule, so a meeting is usable immediately.
  expect(rows[0]!.time).toBe("7:00 pm");
  expect(rows[0]!.location).toBe("Discovery Recreation Center");
  // The id is derivable from the schedule, which is what makes this repeatable.
  expect(rows[0]!.id).toBe(`${rows[0]!.date}-board`);
});

test("running it again creates nothing", async () => {
  await materializeMeetings(env.DB, new Date("2026-01-05"));
  const before = await boardMeetings();
  const { created } = await materializeMeetings(env.DB, new Date("2026-01-05"));
  expect(created).toBe(0);
  expect(await boardMeetings()).toEqual(before);
});

test("a meeting the board cancelled is not brought back", async () => {
  await materializeMeetings(env.DB, new Date("2026-01-05"));
  const [first] = await boardMeetings();
  await env.DB.prepare("update meetings set status = 'cancelled' where id = ?")
    .bind(first!.id)
    .run();

  await materializeMeetings(env.DB, new Date("2026-01-05"));

  const after = (await boardMeetings()).find((m) => m.id === first!.id);
  expect(after?.status, "the scheduler resurrected a cancelled meeting").toBe(
    "cancelled",
  );
});

test("moving forward in time extends the horizon rather than starting over", async () => {
  await materializeMeetings(env.DB, new Date("2026-01-05"));
  const firstRun = await boardMeetings();
  // Two months later the far end has grown; the near end is untouched.
  const { created } = await materializeMeetings(env.DB, new Date("2026-03-05"));
  expect(created).toBeGreaterThan(0);
  const second = await boardMeetings();
  expect(second.length).toBeGreaterThan(firstRun.length);
  expect(second.slice(0, firstRun.length)).toEqual(firstRun);
});

test("a moved meeting keeps its slot, so the old date is not put back", async () => {
  await materializeMeetings(env.DB, new Date("2026-01-05"));
  const [first] = await boardMeetings();
  const moved = "2026-01-27";
  // Moving edits the date; the id still records the slot the rule gave it.
  await env.DB.prepare("update meetings set date = ? where id = ?")
    .bind(moved, first!.id)
    .run();

  await materializeMeetings(env.DB, new Date("2026-01-05"));

  const rows = await boardMeetings();
  expect(rows.filter((m) => m.id === first!.id)).toHaveLength(1);
  expect(rows.find((m) => m.id === first!.id)?.date).toBe(moved);
  expect(
    rows.some((m) => m.id !== first!.id && m.date === first!.date),
    "the scheduler re-created the meeting at its original date",
  ).toBe(false);
});
