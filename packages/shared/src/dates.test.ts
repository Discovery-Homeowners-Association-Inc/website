import { describe, expect, it } from "vitest";
import { dayOfMonth, longDate, monthShort } from "./dates.ts";

describe("calendar dates", () => {
  it("never shifts the day for a reader behind UTC", () => {
    // Parsed at midnight this would read as the 14th in New York.
    expect(longDate("2026-09-15")).toBe("Tuesday, September 15, 2026");
    expect(monthShort("2026-09-15")).toBe("Sep");
    expect(dayOfMonth("2026-09-15")).toBe("15");
  });

  it("handles the first of a month, where an off-by-one crosses months", () => {
    expect(longDate("2027-01-01")).toBe("Friday, January 1, 2027");
    expect(monthShort("2027-01-01")).toBe("Jan");
    expect(dayOfMonth("2027-01-01")).toBe("1");
  });
});
