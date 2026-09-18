/**
 * Formatting calendar dates for people to read, shared by both apps.
 *
 * A YYYY-MM-DD date is a calendar date, not an instant. Parsed at midnight it
 * lands on the previous day for anyone behind UTC, which is everyone here, so
 * it is parsed at noon and formatted in UTC: the day can never shift.
 */
const civil = (iso: string) => new Date(`${iso}T12:00:00Z`);

export const longDate = (iso: string) =>
  new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(civil(iso));

export const monthShort = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(
    civil(iso),
  );

export const dayOfMonth = (iso: string) => String(civil(iso).getUTCDate());
