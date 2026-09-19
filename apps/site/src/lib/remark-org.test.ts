import { describe, expect, it } from "vitest";
import remarkOrg from "./remark-org.ts";

type Node = { type: string; value?: string; url?: string; children?: Node[] };
const paragraph = (text: string): Node => ({
  type: "root",
  children: [{ type: "paragraph", children: [{ type: "text", value: text }] }],
});
const run = (text: string) => {
  const tree = paragraph(text);
  remarkOrg()(tree);
  return tree.children![0]!.children!;
};

describe("remark-org", () => {
  it("replaces a setting token with the value the board edits", () => {
    const [before, value] = run("Monthly: {{setting:rv-lot.fees.monthly}}");
    expect(before).toEqual({ type: "text", value: "Monthly: " });
    expect(value).toEqual({ type: "text", value: "$50.00" });
  });
  it("fails the build on a path that is not a string or number", () => {
    expect(() => run("{{setting:rv-lot.fees}}")).toThrow(/rv-lot\.fees/);
    expect(() => run("{{setting:nope.nothing}}")).toThrow(/nope\.nothing/);
  });
  it("still links the office", () => {
    const [link] = run("{{phone:office}}");
    expect(link?.type).toBe("link");
    expect(link?.url).toBe("tel:+13018452050");
  });
});
