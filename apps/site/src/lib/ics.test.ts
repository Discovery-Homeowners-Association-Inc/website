import { describe, expect, it } from "vitest";
import { escapeText, foldLine } from "./ics.ts";

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
