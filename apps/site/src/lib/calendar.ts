import { getCollection } from "astro:content";
import { occurrences, todayInNewYork } from "@dhoa/shared";
import { meetingOverrides, org } from "./data";
import { dateOf } from "./dates";

export type CalendarItem = {
  date: string;
  title: string;
  time: string;
  location: string;
  href: string;
  kind: "meeting" | "event";
  note?: string;
};

/** Board meetings from the rule plus overrides, merged with any published meeting record. */
export async function boardMeetings(
  from: string,
  months: number,
): Promise<CalendarItem[]> {
  const b = org.meetings.board;
  const records = await getCollection("meetings");
  return occurrences(
    { ordinal: b.ordinal, weekday: b.weekday },
    from,
    months,
    meetingOverrides,
  ).map((o) => {
    const record = records.find(
      (r) => r.data.date === o.date && r.data.type === "board",
    );
    return {
      date: o.date,
      title: "Board of directors meeting",
      time: o.time ?? record?.data.time ?? b.time,
      location: o.location ?? record?.data.location ?? b.location,
      href: record ? `/meetings/${record.id}/` : "/meetings/",
      kind: "meeting",
      note: o.note,
    };
  });
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
  const meetings = await boardMeetings(today, 3);
  return [...meetings, ...events]
    .toSorted((a, b) => a.date.localeCompare(b.date))
    .slice(0, limit);
}
