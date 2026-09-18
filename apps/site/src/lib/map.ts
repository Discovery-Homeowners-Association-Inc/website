/**
 * Where a coordinate falls on the neighborhood map.
 *
 * `discovery-map.svg` is rendered by `render-neighborhood-map.py` in the
 * association's tools repository: it frames the themed streets with a margin
 * and projects them with Web Mercator. These are that same frame and that
 * same projection, so a marker placed here lands on the right street.
 *
 * `map.test.ts` checks the frame against the asset's own viewBox, which is
 * what catches the map being re-rendered from different data.
 */

/** The frame `render-neighborhood-map.py` chose, in degrees. */
export const MAP_FRAME = {
  south: 39.459993,
  west: -77.36538,
  north: 39.472101,
  east: -77.354339,
} as const;

/** The width of the rendered SVG in its own units; the height follows. */
export const MAP_WIDTH = 1000;

const mercator = (lat: number) =>
  Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));

const TOP = mercator(MAP_FRAME.north);
const BOTTOM = mercator(MAP_FRAME.south);

export const MAP_HEIGHT =
  (MAP_WIDTH * (TOP - BOTTOM)) /
  (((MAP_FRAME.east - MAP_FRAME.west) * Math.PI) / 180);

/** A coordinate in the SVG's own units. */
export function project(lat: number, lon: number): { x: number; y: number } {
  return {
    x: ((lon - MAP_FRAME.west) / (MAP_FRAME.east - MAP_FRAME.west)) * MAP_WIDTH,
    y: MAP_HEIGHT - ((mercator(lat) - BOTTOM) / (TOP - BOTTOM)) * MAP_HEIGHT,
  };
}

/**
 * Whether a coordinate is inside the frame at all. A marker the board has
 * mistyped would otherwise be drawn off the edge of the picture, stretching
 * the layout for everyone; this leaves it out of the map instead. It still
 * appears in the list, which is where the information actually is.
 */
export const onTheMap = (lat: number, lon: number): boolean =>
  lat >= MAP_FRAME.south &&
  lat <= MAP_FRAME.north &&
  lon >= MAP_FRAME.west &&
  lon <= MAP_FRAME.east;
