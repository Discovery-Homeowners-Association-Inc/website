import { describe, expect, it } from "vitest";
import { dayInYear, eventWhen } from "./dates.ts";

describe("dayInYear", () => {
  it("turns a due date the board wrote into a calendar date", () => {
    expect(dayInYear("January 1", 2026)).toBe("2026-01-01");
    expect(dayInYear("April 1", 2026)).toBe("2026-04-01");
    expect(dayInYear("October 1", 2026)).toBe("2026-10-01");
  });

  it("handles a date near a daylight-saving change", () => {
    // Parsed at noon, so a midnight parse cannot land on the day before.
    expect(dayInYear("March 8", 2026)).toBe("2026-03-08");
    expect(dayInYear("November 1", 2026)).toBe("2026-11-01");
  });

  it("says so rather than guessing when it cannot parse", () => {
    expect(dayInYear("Whenever", 2026)).toBeNull();
    expect(dayInYear("", 2026)).toBeNull();
  });
});

describe("eventWhen", () => {
  it("gives one date for a same-day event", () => {
    expect(
      eventWhen(
        new Date("2026-05-23T16:00:00Z"),
        new Date("2026-05-24T00:00:00Z"),
      ),
    ).toBe("Saturday, May 23, 2026, 12:00 pm to 8:00 pm");
  });
  it("gives both dates when the event runs past midnight", () => {
    expect(
      eventWhen(
        new Date("2026-05-23T16:00:00Z"),
        new Date("2026-05-24T16:00:00Z"),
      ),
    ).toBe(
      "Saturday, May 23, 2026, 12:00 pm to Sunday, May 24, 2026, 12:00 pm",
    );
  });
});
