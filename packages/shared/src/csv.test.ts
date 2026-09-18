import { describe, expect, it } from "vitest";
import { toCsv } from "./csv.ts";

describe("toCsv", () => {
  it("writes a header from the keys and a line per row", () => {
    expect(toCsv([{ name: "Ada", role: "admin" }])).toBe(
      "name,role\r\nAda,admin",
    );
  });

  it("quotes what has to be quoted, and doubles inner quotes", () => {
    expect(toCsv([{ a: "x,y" }])).toBe('a\r\n"x,y"');
    expect(toCsv([{ a: 'say "hi"' }])).toBe('a\r\n"say ""hi"""');
    expect(toCsv([{ a: "one\ntwo" }])).toBe('a\r\n"one\ntwo"');
    expect(toCsv([{ a: " padded " }])).toBe('a\r\n" padded "');
  });

  it("leaves plain values unquoted", () => {
    expect(toCsv([{ a: "plain", b: 42, c: true }])).toBe(
      "a,b,c\r\nplain,42,true",
    );
  });

  it("writes an empty cell for nothing, not the word undefined", () => {
    expect(toCsv([{ a: null, b: undefined, c: "" }])).toBe("a,b,c\r\n,,");
  });

  it("keeps nested values as JSON rather than dropping them", () => {
    expect(toCsv([{ tags: ["a", "b"] }])).toBe('tags\r\n"[""a"",""b""]"');
  });

  it("takes the union of keys, in the order they are first seen", () => {
    expect(toCsv([{ a: 1 }, { b: 2 }, { a: 3, b: 4 }])).toBe(
      "a,b\r\n1,\r\n,2\r\n3,4",
    );
  });

  it("has nothing to say about no rows", () => {
    expect(toCsv([])).toBe("");
  });
});
