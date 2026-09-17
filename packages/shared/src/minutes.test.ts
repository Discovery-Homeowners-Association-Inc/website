import { describe, expect, it } from "vitest";
import { canTransition } from "./minutes.ts";

describe("minutes transitions", () => {
  it("never publishes before approval", () => {
    for (const from of ["draft", "in_review", "ready_for_vote"] as const) {
      expect(canTransition(from, "published", ["admin", "secretary"])).toBe(
        false,
      );
    }
  });
  it("lets the secretary publish approved minutes", () => {
    expect(canTransition("approved", "published", ["secretary"])).toBe(true);
  });
  it("does not let a board member publish", () => {
    expect(canTransition("approved", "published", ["board"])).toBe(false);
  });
  it("does not let an editor approve", () => {
    expect(canTransition("ready_for_vote", "approved", ["editor"])).toBe(false);
  });
});
