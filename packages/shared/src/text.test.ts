import { describe, expect, it } from "vitest";
import { capitalize, decapitalize } from "./text.ts";

describe("first-letter case", () => {
  it("changes only the first letter", () => {
    expect(capitalize("off Treasure Avenue")).toBe("Off Treasure Avenue");
    expect(decapitalize("Off Treasure Avenue")).toBe("off Treasure Avenue");
  });

  it("leaves the rest of the string exactly as it was", () => {
    expect(capitalize("iPhone dock")).toBe("IPhone dock");
    expect(decapitalize("PayHOA export")).toBe("payHOA export");
  });

  it("is safe on empty text, which settings allow", () => {
    expect(capitalize("")).toBe("");
    expect(decapitalize("")).toBe("");
  });

  it("leaves text that needs no change alone", () => {
    expect(capitalize("Already up")).toBe("Already up");
    expect(decapitalize("already down")).toBe("already down");
  });
});
