import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { boardMeetings } from "../lib/calendar";
import { org } from "../lib/data";

/** RFC 5545 text escaping and 75-octet line folding. */
const esc = (s: string) =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
const fold = (line: string) => line.match(/.{1,74}/g)!.join("\r\n ");
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
  const today = new Date().toISOString().slice(0, 10);
  const start = `${Number(today.slice(0, 4)) - 1}${today.slice(4, 7)}-01`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Discovery Homeowners Association//Website//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${esc(org.short_name)}`,
    "X-WR-TIMEZONE:America/New_York",
  ];
  for (const m of await boardMeetings(start, 24)) {
    const s = local(m.date, m.time);
    lines.push(
      "BEGIN:VEVENT",
      `UID:board-${m.date}@discoveryhomeowners.com`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=America/New_York:${s}`,
      "DURATION:PT2H",
      `SUMMARY:${esc(m.title)}`,
      `LOCATION:${esc(m.location)}`,
      `URL:${new URL(m.href, site)}`,
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
