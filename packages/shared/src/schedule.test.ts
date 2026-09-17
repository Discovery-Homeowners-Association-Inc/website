import { describe, expect, it } from "vitest";
import { nthWeekday, occurrences, todayInNewYork } from "./schedule.ts";

const thirdTuesday = { ordinal: 3, weekday: 2 } as const;

describe("nthWeekday", () => {
  it("finds the third Tuesday", () => {
    expect(nthWeekday(2026, 9, thirdTuesday)).toBe("2026-09-15");
    expect(nthWeekday(2026, 10, thirdTuesday)).toBe("2026-10-20");
    expect(nthWeekday(2026, 12, thirdTuesday)).toBe("2026-12-15");
  });
  it("handles a month that starts on the target weekday", () => {
    expect(nthWeekday(2026, 12, { ordinal: 1, weekday: 2 })).toBe("2026-12-01");
  });
});

describe("occurrences", () => {
  it("skips a meeting that already happened this month", () => {
    expect(
      occurrences(thirdTuesday, "2026-09-17", 2).map((o) => o.date),
    ).toEqual(["2026-10-20"]);
  });
  it("rolls over the year", () => {
    expect(
      occurrences(thirdTuesday, "2026-12-01", 2).map((o) => o.date),
    ).toEqual(["2026-12-15", "2027-01-19"]);
  });
});

describe("todayInNewYork", () => {
  it("uses Eastern time, not UTC", () => {
    expect(todayInNewYork(new Date("2026-09-17T02:00:00Z"))).toBe("2026-09-16");
  });
});
