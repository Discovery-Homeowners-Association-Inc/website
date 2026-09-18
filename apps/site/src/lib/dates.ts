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
