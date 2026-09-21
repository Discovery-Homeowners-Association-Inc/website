import { MEETING_LABEL, type MeetingType } from "@dhoa/shared";

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
  /** Meetings only: whether the agenda is up yet, which decides whether the page is worth a link. */
  agendaPublished?: boolean;
};

export type MeetingRecord = {
  id: string;
  data: {
    type: MeetingType;
    date: string;
    time: string;
    location: string;
    status: "scheduled" | "canceled" | "held";
    agenda_published: string | null;
  };
};

/**
 * Meetings from a date, soonest first. Every kind: an annual meeting is where
 * directors are elected, and the earlier version listed only board meetings, so
 * it appeared nowhere on the site and in no one's calendar.
 *
 * Canceled meetings are left out of the pages, where only what is happening
 * matters. The calendar feed asks for them, because a subscriber already has
 * the old entry and needs to be told it is off.
 */
export function selectMeetings(
  records: readonly MeetingRecord[],
  from: string,
  limit: number,
  {
    includeCanceled = false,
    type,
  }: { includeCanceled?: boolean; type?: MeetingType } = {},
): CalendarItem[] {
  return records
    .filter(
      (r) =>
        (type === undefined || r.data.type === type) &&
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
      agendaPublished: r.data.agenda_published !== null,
    }));
}
