import { describe, expect, it } from "vitest";
import { isServing, isVisible, itemActions, slugify } from "./content.ts";

const at = (s: string) => new Date(s);

describe("isVisible", () => {
  const base = {
    status: "published" as const,
    publish_at: "2026-10-01T09:00:00-04:00",
    expires_at: null,
  };
  it("hides drafts and pending items", () => {
    expect(
      isVisible({ ...base, status: "draft" }, at("2026-10-02T00:00:00Z")),
    ).toBe(false);
    expect(
      isVisible({ ...base, status: "pending" }, at("2026-10-02T00:00:00Z")),
    ).toBe(false);
  });
  it("hides an item until its publish date, then shows it", () => {
    expect(isVisible(base, at("2026-09-30T00:00:00Z"))).toBe(false);
    expect(isVisible(base, at("2026-10-01T13:00:01Z"))).toBe(true);
  });
  it("hides an item once it expires", () => {
    const exp = { ...base, expires_at: "2026-12-01T00:00:00-05:00" };
    expect(isVisible(exp, at("2026-11-30T00:00:00Z"))).toBe(true);
    expect(isVisible(exp, at("2026-12-01T05:00:00Z"))).toBe(false);
  });
});

describe("itemActions", () => {
  it("lets an editor only submit", () => {
    expect(
      itemActions({
        status: "draft",
        roles: ["editor"],
        isAuthor: true,
        requiresApproval: false,
      }),
    ).toEqual(["submit"]);
    expect(
      itemActions({
        status: "pending",
        roles: ["editor"],
        isAuthor: false,
        requiresApproval: true,
      }),
    ).toEqual([]);
  });
  it("lets a secretary publish directly only when approval is not required", () => {
    expect(
      itemActions({
        status: "draft",
        roles: ["secretary"],
        isAuthor: true,
        requiresApproval: false,
      }),
    ).toEqual(["publish", "submit"]);
    expect(
      itemActions({
        status: "draft",
        roles: ["secretary"],
        isAuthor: true,
        requiresApproval: true,
      }),
    ).toEqual(["submit"]);
  });
  it("never lets people approve their own submission", () => {
    expect(
      itemActions({
        status: "pending",
        roles: ["admin"],
        isAuthor: true,
        requiresApproval: true,
      }),
    ).toEqual([]);
    expect(
      itemActions({
        status: "pending",
        roles: ["board"],
        isAuthor: false,
        requiresApproval: true,
      }),
    ).toEqual(["approve", "reject"]);
  });
  it("lets only admins and secretaries take something down", () => {
    expect(
      itemActions({
        status: "published",
        roles: ["board"],
        isAuthor: false,
        requiresApproval: true,
      }),
    ).toEqual([]);
    expect(
      itemActions({
        status: "published",
        roles: ["admin"],
        isAuthor: false,
        requiresApproval: true,
      }),
    ).toEqual(["unpublish"]);
  });
});

describe("slugify", () => {
  it("makes URL-safe slugs", () => {
    expect(slugify("Pool passes for 2026 are on sale!")).toBe(
      "pool-passes-for-2026-are-on-sale",
    );
    expect(slugify("Señor Café")).toBe("senor-cafe");
    expect(slugify("!!!")).toBe("item");
  });
});

describe("isServing", () => {
  it("treats a missing or future end date as serving", () => {
    expect(isServing({ term_end: null }, "2026-09-17")).toBe(true);
    expect(isServing({ term_end: "2026-12-31" }, "2026-09-17")).toBe(true);
    expect(isServing({ term_end: "2026-09-16" }, "2026-09-17")).toBe(false);
  });
});
