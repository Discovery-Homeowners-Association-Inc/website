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

  it("stops a spreadsheet running what someone typed", () => {
    // An editor picks the title of a news item; an administrator exports
    // content and opens it. Without the quote, Excel runs this.
    expect(toCsv([{ title: '=HYPERLINK("https://evil.test","click")' }])).toBe(
      'title\r\n"\'=HYPERLINK(""https://evil.test"",""click"")"',
    );
    for (const lead of ["=", "+", "-", "@", "\t", "\r"]) {
      const out = toCsv([{ a: `${lead}danger` }]);
      expect(out.split("\r\n")[1]?.replace(/^"|"$/g, "")).toBe(
        `'${lead}danger`,
      );
    }
  });

  it("leaves numbers alone, including negative ones", () => {
    // A guarded "-5" would stop being a number in the spreadsheet.
    expect(toCsv([{ balance: -5 }])).toBe("balance\r\n-5");
    expect(toCsv([{ balance: 0 }])).toBe("balance\r\n0");
  });

  it("has nothing to say about no rows", () => {
    expect(toCsv([])).toBe("");
  });
});
