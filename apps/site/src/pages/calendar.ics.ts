import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { todayInNewYork } from "@dhoa/shared";
import { meetings } from "../lib/calendar";
import { escapeText as esc, foldLine as fold } from "../lib/ics";
import { org } from "../lib/data";

/*
 * TZID names a time zone the calendar has to define. Most clients know
 * America/New_York anyway, but RFC 5545 says the definition travels with the
 * object, and the strict ones drop every event without it. These are the US
 * rules in force since 2007.
 */
const NEW_YORK = [
  "BEGIN:VTIMEZONE",
  "TZID:America/New_York",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:-0500",
  "TZOFFSETTO:-0400",
  "TZNAME:EDT",
  "DTSTART:19700308T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:-0400",
  "TZOFFSETTO:-0500",
  "TZNAME:EST",
  "DTSTART:19701101T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];
const utc = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

/** "7:00 pm" on a YYYY-MM-DD in New York, as a floating local time with TZID. */
function local(date: string, time: string): string {
  const m = time.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (!m) throw new Error(`Cannot parse meeting time "${time}"`);
  let h = Number(m[1]) % 12;
  if (m[3]!.toLowerCase() === "pm") h += 12;
  return `${date.replace(/-/g, "")}T${String(h).padStart(2, "0")}${m[2]}00`;
}

export const GET: APIRoute = async ({ site }) => {
  const stamp = utc(new Date());
  const today = todayInNewYork();
  const start = `${Number(today.slice(0, 4)) - 1}${today.slice(4, 7)}-01`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Discovery Homeowners Association//Website//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${esc(org.short_name)}`,
    "X-WR-TIMEZONE:America/New_York",
    ...NEW_YORK,
  ];
  /*
   * Canceled meetings are included, marked as such. A subscriber already has
   * the entry; leaving it out of the feed leaves it in their calendar, and they
   * turn up to a meeting that is not happening.
   */
  for (const m of await meetings(start, Infinity, { includeCanceled: true })) {
    const s = local(m.date, m.time);
    lines.push(
      "BEGIN:VEVENT",
      // The record's id, not its date: a meeting that moves has to update the
      // entry a subscriber already has, rather than becoming a second one that
      // never goes away.
      //
      // The prefix stays "board-", even for every other kind of meeting now
      // included here, so an existing subscriber's calendar entries keep the
      // same UID and are updated in place rather than duplicated.
      `UID:board-${m.id}@discoveryhomeowners.com`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=America/New_York:${s}`,
      "DURATION:PT2H",
      `SUMMARY:${esc(m.status === "canceled" ? `Canceled: ${m.title}` : m.title)}`,
      `LOCATION:${esc(m.location)}`,
      `URL:${new URL(m.href, site)}`,
      ...(m.status === "canceled" ? ["STATUS:CANCELLED"] : []),
      "END:VEVENT",
    );
  }
  for (const e of await getCollection("events")) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:event-${e.id}@discoveryhomeowners.com`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${utc(e.data.start)}`,
      `DTEND:${utc(e.data.end)}`,
      `SUMMARY:${esc(e.data.title)}`,
      `DESCRIPTION:${esc(e.data.summary)}`,
      `LOCATION:${esc(e.data.location)}`,
      `URL:${new URL(`/events/${e.id}/`, site)}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return new Response(lines.map(fold).join("\r\n") + "\r\n", {
    headers: { "Content-Type": "text/calendar; charset=utf-8" },
  });
};
