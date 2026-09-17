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
