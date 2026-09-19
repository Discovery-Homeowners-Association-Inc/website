import { getCollection } from "astro:content";
import { todayInNewYork, type MeetingType } from "@dhoa/shared";
import { dateOf, timeOf } from "./dates";
import { selectMeetings, type CalendarItem } from "./meetings";

export type { CalendarItem };

export async function meetings(
  from: string,
  limit: number,
  options: { includeCanceled?: boolean; type?: MeetingType } = {},
): Promise<CalendarItem[]> {
  return selectMeetings(await getCollection("meetings"), from, limit, options);
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
      time: timeOf(e.data.start),
      location: e.data.location,
      href: `/events/${e.id}/`,
      kind: "event",
    }));
  return [...(await meetings(today, limit)), ...events]
    .toSorted((a, b) => a.date.localeCompare(b.date))
    .slice(0, limit);
}
