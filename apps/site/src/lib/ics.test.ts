import { describe, expect, it } from "vitest";
import { dtstart, escapeText, foldLine } from "./ics.ts";

describe("escapeText", () => {
  it("escapes a semicolon, which is what a room number looks like", () => {
    // "Rec Center; Room 2" silently corrupted the whole event before this: the
    // escape was written "@;", which in JavaScript is just ";".
    expect(escapeText("Rec Center; Room 2")).toBe("Rec Center\\; Room 2");
  });

  it("escapes commas, backslashes and newlines", () => {
    expect(escapeText("Walkersville, MD")).toBe("Walkersville\\, MD");
    expect(escapeText("a\\b")).toBe("a\\\\b");
    expect(escapeText("one\ntwo")).toBe("one\\ntwo");
    expect(escapeText("one\r\ntwo")).toBe("one\\ntwo");
  });

  it("escapes the backslash first, so an escape is not escaped twice", () => {
    expect(escapeText("a;b")).toBe("a\\;b");
    expect(escapeText("a\\;b")).toBe("a\\\\\\;b");
  });

  it("leaves ordinary text alone", () => {
    expect(escapeText("Board meeting")).toBe("Board meeting");
  });
});

describe("dtstart", () => {
  it("places a local time in New York", () => {
    expect(dtstart("2026-10-20", "7:00 pm")).toEqual([
      "DTSTART;TZID=America/New_York:20261020T190000",
      "DURATION:PT2H",
    ]);
    expect(dtstart("2026-10-20", "12:30 AM")[0]).toBe(
      "DTSTART;TZID=America/New_York:20261020T003000",
    );
  });
  it("falls back to an all-day entry rather than failing the whole feed", () => {
    // The admin app validates the time now, but a value already in the database
    // is whatever it is, and one bad meeting must not take the calendar down.
    expect(dtstart("2026-10-20", "7pm")).toEqual([
      "DTSTART;VALUE=DATE:20261020",
    ]);
  });
});

describe("foldLine", () => {
  it("leaves a short line alone", () => {
    expect(foldLine("SUMMARY:Board meeting")).toBe("SUMMARY:Board meeting");
  });

  it("folds a long line with a leading space on each continuation", () => {
    const folded = foldLine("X:" + "a".repeat(200));
    for (const line of folded.split("\r\n"))
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(
      folded
        .split("\r\n")
        .slice(1)
        .every((l) => l.startsWith(" ")),
    ).toBe(true);
    expect(folded.replaceAll("\r\n ", "")).toBe("X:" + "a".repeat(200));
  });

  it("counts octets, not characters", () => {
    // Each of these is three bytes, so 74 characters would be 222 octets.
    const folded = foldLine("X:" + "\u2605".repeat(60));
    for (const line of folded.split("\r\n"))
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(folded.replaceAll("\r\n ", "")).toBe("X:" + "\u2605".repeat(60));
  });
});
