import { describe, expect, it } from "vitest";
import { canExport, canTransition } from "./minutes.ts";

describe("minutes transitions", () => {
  it("never files minutes before approval", () => {
    for (const from of ["draft", "in_review", "ready_for_vote"] as const) {
      expect(canTransition(from, "filed", ["admin", "secretary"])).toBe(false);
    }
  });
  it("lets the secretary file approved minutes", () => {
    expect(canTransition("approved", "filed", ["secretary"])).toBe(true);
  });
  it("does not let a board member file minutes", () => {
    expect(canTransition("approved", "filed", ["board"])).toBe(false);
  });
  it("does not let an editor approve", () => {
    expect(canTransition("ready_for_vote", "approved", ["editor"])).toBe(false);
  });
});

describe("export", () => {
  it("is only possible once minutes are approved", () => {
    expect(canExport("draft")).toBe(false);
    expect(canExport("in_review")).toBe(false);
    expect(canExport("ready_for_vote")).toBe(false);
    expect(canExport("approved")).toBe(true);
    expect(canExport("filed")).toBe(true);
  });
});
