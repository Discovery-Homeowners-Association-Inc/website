/**
 * Recurring meetings are stored as a rule ("third Tuesday"), not as rows, so
 * nobody has to enter twelve meetings every January. Dates are calendar dates
 * in the association's own time zone, expressed as YYYY-MM-DD strings to keep
 * them free of UTC drift.
 */
export type MonthlyRule = {
  ordinal: 1 | 2 | 3 | 4;
  weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6;
};

export type Override =
  | { date: string; status: "cancelled"; note?: string }
  | {
      date: string;
      status: "moved";
      moved_to: string;
      time?: string;
      location?: string;
      note?: string;
    };

export type Occurrence = {
  date: string;
  time?: string;
  location?: string;
  note?: string;
  originalDate: string;
};

const pad = (n: number) => String(n).padStart(2, "0");
export const isoDate = (y: number, m: number, d: number) =>
  `${y}-${pad(m)}-${pad(d)}`;

/** The date of the nth weekday in a month. `month` is 1-12. */
export function nthWeekday(
  year: number,
  month: number,
  rule: MonthlyRule,
): string {
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const day =
    1 + ((rule.weekday - firstWeekday + 7) % 7) + (rule.ordinal - 1) * 7;
  return isoDate(year, month, day);
}

/** Meetings from `from` (inclusive) for `months` months, with overrides applied. */
export function occurrences(
  rule: MonthlyRule,
  from: string,
  months: number,
  overrides: readonly Override[] = [],
): Occurrence[] {
  const [y, m] = from.split("-").map(Number) as [number, number];
  const out: Occurrence[] = [];
  for (let i = 0; i < months; i++) {
    const year = y + Math.floor((m - 1 + i) / 12);
    const month = ((m - 1 + i) % 12) + 1;
    const date = nthWeekday(year, month, rule);
    const o = overrides.find((x) => x.date === date);
    if (o?.status === "cancelled") continue;
    const entry: Occurrence =
      o?.status === "moved"
        ? {
            date: o.moved_to,
            time: o.time,
            location: o.location,
            note: o.note,
            originalDate: date,
          }
        : { date, originalDate: date };
    if (entry.date >= from) out.push(entry);
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** Today's date in America/New_York as YYYY-MM-DD. */
export function todayInNewYork(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
