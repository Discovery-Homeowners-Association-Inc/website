import { getCollection } from "astro:content";
import { todayInNewYork } from "@dhoa/shared";
import { dateOf } from "./dates";

export type CalendarItem = {
  date: string;
  title: string;
  time: string;
  location: string;
  href: string;
  kind: "meeting" | "event";
  note?: string;
  /** Meetings only: whether the agenda is up yet, which changes what we say. */
  agendaPublished?: boolean;
};

/**
 * Board meetings, read from the records the admin app keeps.
 *
 * These used to be generated here from the recurrence rule, which meant the
 * site advertised meetings that existed nowhere else and could not carry an
 * agenda. The rule now produces records (see the admin app's scheduler), and a
 * meeting is canceled or moved by editing the record.
 */
export async function boardMeetings(
  from: string,
  limit: number,
): Promise<CalendarItem[]> {
  const records = await getCollection("meetings");
  return records
    .filter(
      (r) =>
        r.data.type === "board" &&
        r.data.status !== "canceled" &&
        r.data.date >= from,
    )
    .toSorted((a, b) => a.data.date.localeCompare(b.data.date))
    .slice(0, limit)
    .map((r) => ({
      date: r.data.date,
      title: "Board of directors meeting",
      time: r.data.time,
      location: r.data.location,
      href: `/meetings/${r.id}/`,
      kind: "meeting" as const,
      agendaPublished: r.data.agenda.length > 0,
    }));
}

export async function upcoming(
  limit: number,
  today = todayInNewYork(),
): Promise<CalendarItem[]> {
  const events = (await getCollection("events"))
    .filter((e) => dateOf(e.data.end) >= today)
    .map<CalendarItem>((e) => ({
      date: dateOf(e.data.start),
      title: e.data.title,
      time: "",
      location: e.data.location,
      href: `/events/${e.id}/`,
      kind: "event",
    }));
  const meetings = await boardMeetings(today, limit);
  return [...meetings, ...events]
    .toSorted((a, b) => a.date.localeCompare(b.date))
    .slice(0, limit);
}
