const TZ = "America/New_York";

/** Parse a YYYY-MM-DD calendar date at noon UTC so formatting never shifts the day. */
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
