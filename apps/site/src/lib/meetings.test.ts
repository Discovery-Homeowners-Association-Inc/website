import { describe, expect, it } from "vitest";
import { selectMeetings, type MeetingRecord } from "./meetings.ts";

const rec = (
  id: string,
  type: MeetingRecord["data"]["type"],
  status: MeetingRecord["data"]["status"] = "scheduled",
): MeetingRecord => ({
  id,
  data: {
    type,
    date: id.slice(0, 10),
    time: "7:00 pm",
    location: "Discovery Recreation Center",
    status,
    agenda_published: null,
  },
});

describe("selectMeetings", () => {
  const records = [
    rec("2026-10-20-board", "board"),
    rec("2026-11-05-annual", "annual"),
    rec("2026-09-15-board", "board"),
    rec("2026-12-15-board", "board", "canceled"),
  ];
  it("lists every kind of meeting, soonest first, from a date", () => {
    expect(selectMeetings(records, "2026-10-01", 10).map((m) => m.id)).toEqual([
      "2026-10-20-board",
      "2026-11-05-annual",
    ]);
  });
  it("names each kind", () => {
    const [, annual] = selectMeetings(records, "2026-10-01", 10);
    expect(annual?.title).toBe("Annual meeting");
  });
  it("can be asked for one kind, for the next board meeting on the home page", () => {
    expect(
      selectMeetings(records, "2026-10-21", 1, { type: "board" }).map(
        (m) => m.id,
      ),
    ).toEqual([]);
    expect(
      selectMeetings(records, "2026-09-01", 1, { type: "board" }).map(
        (m) => m.id,
      ),
    ).toEqual(["2026-09-15-board"]);
  });
  it("leaves canceled meetings out unless the calendar feed asks", () => {
    expect(selectMeetings(records, "2026-12-01", 10)).toEqual([]);
    expect(
      selectMeetings(records, "2026-12-01", 10, { includeCanceled: true }).map(
        (m) => m.status,
      ),
    ).toEqual(["canceled"]);
  });
});
