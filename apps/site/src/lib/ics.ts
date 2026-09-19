/**
 * The two pieces of RFC 5545 that are easy to get quietly wrong.
 *
 * They live here rather than inside the route so they can be tested. The
 * semicolon escape was wrong for as long as the feed existed -- written
 * `"\;"`, which in JavaScript is just `";"` -- and nothing noticed, because the
 * escapes on either side of it were right and no meeting had ever had a
 * semicolon in its location.
 */
import { MEETING_TIME } from "@dhoa/shared";

/** Escapes a TEXT value: backslash, semicolon, comma and newline (RFC 5545 §3.3.11). */
export const escapeText = (text: string) =>
  text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");

/**
 * Folds a content line so no line exceeds 75 octets, continuing with a space.
 *
 * Measured in octets rather than characters, because the limit is on the wire
 * and an accented character or an emoji is more than one byte.
 */
export function foldLine(line: string): string {
  const out: string[] = [];
  let current = "";
  let octets = 0;
  for (const char of line) {
    const size = new TextEncoder().encode(char).length;
    // 74, so the leading space on a continuation line still fits in 75.
    if (octets + size > 74) {
      out.push(current);
      current = "";
      octets = 0;
    }
    current += char;
    octets += size;
  }
  out.push(current);
  return out.join("\r\n ");
}

/**
 * The start of a meeting as iCalendar lines: a floating local time in New York
 * with a two-hour duration, or -- when the stored time is not one the feed can
 * read -- an all-day entry. The feed used to throw here, which failed the
 * whole site build over one typed time.
 */
export function dtstart(date: string, time: string): string[] {
  const m = time.trim().match(MEETING_TIME);
  const day = date.replace(/-/g, "");
  if (!m) return [`DTSTART;VALUE=DATE:${day}`];
  let h = Number(m[1]) % 12;
  if (m[2]!.toLowerCase() === "pm") h += 12;
  const [, , minutes] = time.trim().match(/^(\d{1,2}):(\d{2})/)!;
  return [
    `DTSTART;TZID=America/New_York:${day}T${String(h).padStart(2, "0")}${minutes}00`,
    "DURATION:PT2H",
  ];
}
