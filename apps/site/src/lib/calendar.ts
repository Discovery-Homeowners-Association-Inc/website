import { getCollection } from "astro:content";
import { MEETING_LABEL, todayInNewYork } from "@dhoa/shared";
import { dateOf } from "./dates";

export type CalendarItem = {
  /** The meeting record's id. Stable across a change of date, unlike the date. */
  id: string;
  date: string;
  title: string;
  time: string;
  location: string;
  href: string;
  kind: "meeting" | "event";
  /** Meetings only: "scheduled" unless the board called it off or it was held. */
  status?: "scheduled" | "canceled" | "held";
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
  /*
   * Canceled meetings are left out of the pages, where only what is happening
   * matters. The calendar feed asks for them, because a subscriber already has
   * the old entry and needs to be told it is off -- dropping it silently leaves
   * them planning to attend.
   */
  { includeCanceled = false } = {},
): Promise<CalendarItem[]> {
  const records = await getCollection("meetings");
  return records
    .filter(
      (r) =>
        r.data.type === "board" &&
        (includeCanceled || r.data.status !== "canceled") &&
        r.data.date >= from,
    )
    .toSorted((a, b) => a.data.date.localeCompare(b.data.date))
    .slice(0, limit)
    .map((r) => ({
      id: r.id,
      date: r.data.date,
      title: MEETING_LABEL[r.data.type],
      time: r.data.time,
      location: r.data.location,
      href: `/meetings/${r.id}/`,
      kind: "meeting" as const,
      status: r.data.status,
      // The publish timestamp, rather than inferring it from the agenda having
      // items. Both say the same thing today, because only a published agenda
      // reaches the site at all -- but one says it directly.
      agendaPublished: r.data.agenda_published !== null,
    }));
}

export async function upcoming(
  limit: number,
  today = todayInNewYork(),
): Promise<CalendarItem[]> {
  const events = (await getCollection("events"))
    .filter((e) => dateOf(e.data.end) >= today)
    .map<CalendarItem>((e) => ({
      id: e.id,
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
