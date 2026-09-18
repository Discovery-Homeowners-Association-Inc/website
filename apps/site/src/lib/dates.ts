/**
 * Date helpers for the site. The calendar-date formatters are shared with the
 * admin app, which formats the same dates for the same readers.
 */
export { dayOfMonth, longDate, monthShort } from "@dhoa/shared";

const TZ = "America/New_York";

export const dateOf = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);

export const timeOf = (d: Date) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
  })
    .format(d)
    .toLowerCase();

export const newsDate = (d: Date) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(d);

/**
 * "January 1" in a given year, as YYYY-MM-DD, or null if it will not parse.
 *
 * The assessment due dates are stored the way the board writes them on a
 * notice. The home page needs the next one as a date, and the alternative was
 * a second copy of the four dates written as month-days in the page -- which
 * is what it had, and what left the home page and the dues page free to
 * disagree.
 *
 * Parsed at noon, like every other civil date here, so no time zone can move
 * it to the day before.
 */
export function dayInYear(label: string, year: number): string | null {
  const parsed = new Date(`${label} ${year} 12:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  /*
   * Checked by reading it back. `new Date` is lenient enough to turn
   * "Whenever 2026" into the first of January, so without this a mistyped due
   * date would quietly become New Year's Day on the home page.
   */
  const readBack = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
  }).format(parsed);
  if (readBack.toLowerCase() !== label.trim().toLowerCase()) return null;
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
