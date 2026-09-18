import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MAP_FRAME, MAP_HEIGHT, MAP_WIDTH, onTheMap, project } from "./map.ts";

const svg = readFileSync(
  new URL("../assets/discovery-map.svg", import.meta.url),
  "utf8",
);

describe("the neighborhood map's frame", () => {
  it("matches the viewBox of the map it draws markers on", () => {
    // The frame is a copy of what rendered the asset. If the asset is
    // re-rendered from different data its viewBox moves and every marker
    // silently shifts, so this is the check that they still agree.
    const viewBox = /viewBox="([^"]*)"/.exec(svg)?.[1];
    expect(viewBox).toBeDefined();
    const [, , width, height] = viewBox!.split(/\s+/).map(Number);
    expect(width).toBe(MAP_WIDTH);
    expect(Math.round(MAP_HEIGHT)).toBe(height);
  });

  it("puts the corners of the frame at the corners of the picture", () => {
    const topLeft = project(MAP_FRAME.north, MAP_FRAME.west);
    const bottomRight = project(MAP_FRAME.south, MAP_FRAME.east);
    expect(topLeft.x).toBeCloseTo(0, 6);
    expect(topLeft.y).toBeCloseTo(0, 6);
    expect(bottomRight.x).toBeCloseTo(MAP_WIDTH, 6);
    expect(bottomRight.y).toBeCloseTo(MAP_HEIGHT, 6);
  });

  it("puts north up and east right", () => {
    const middle = project(39.466, -77.36);
    expect(project(39.468, -77.36).y).toBeLessThan(middle.y);
    expect(project(39.466, -77.358).x).toBeGreaterThan(middle.x);
  });
});

describe("onTheMap", () => {
  it("accepts a coordinate in the neighborhood", () => {
    expect(onTheMap(39.466, -77.36)).toBe(true);
  });

  it("rejects one that was never set", () => {
    // A new marker starts at zero, which is in the Atlantic.
    expect(onTheMap(0, 0)).toBe(false);
  });
});
