import { describe, expect, it } from "vitest";
import { canonicalJson, contentHash, MinutesBody } from "./documents.ts";

describe("canonicalJson", () => {
  it("does not depend on key order", () => {
    expect(canonicalJson({ b: 1, a: { d: [1, 2], c: "x" } })).toBe(
      canonicalJson({ a: { c: "x", d: [1, 2] }, b: 1 }),
    );
  });
});

describe("contentHash", () => {
  it("changes when any word changes", async () => {
    const a = MinutesBody.parse({
      items: [{ id: "1", title: "Budget", discussion: "Approved the budget." }],
    });
    const b = MinutesBody.parse({
      items: [{ id: "1", title: "Budget", discussion: "Approved the budget!" }],
    });
    expect(await contentHash(a)).not.toBe(await contentHash(b));
    expect(await contentHash(a)).toBe(await contentHash(structuredClone(a)));
  });
});

describe("MinutesBody", () => {
  it("rejects a motion without a mover", () => {
    const r = MinutesBody.safeParse({
      items: [
        {
          id: "1",
          title: "Fence",
          motions: [{ text: "Approve", moved_by: "", result: "carried" }],
        },
      ],
    });
    expect(r.success).toBe(false);
  });
});

describe("an item's outcome", () => {
  const item = { id: "a", title: "Elm Street drainage" };

  it("closes by default, so old minutes still parse", () => {
    const r = MinutesBody.parse({ items: [item] });
    expect(r.items[0]!.outcome).toBe("closed");
    expect(r.items[0]!.follow_up_owner).toBe("");
    expect(r.items[0]!.follow_up_note).toBe("");
  });

  it("carries who is following an item up, and why", () => {
    const r = MinutesBody.parse({
      items: [
        {
          ...item,
          outcome: "follow_up",
          follow_up_owner: "Bob Thornton",
          follow_up_note: "Waiting on a second quote",
        },
      ],
    });
    expect(r.items[0]!.outcome).toBe("follow_up");
    expect(r.items[0]!.follow_up_owner).toBe("Bob Thornton");
  });

  it("refuses an outcome it does not know", () => {
    const r = MinutesBody.safeParse({
      items: [{ ...item, outcome: "maybe-later" }],
    });
    expect(r.success).toBe(false);
  });
});
