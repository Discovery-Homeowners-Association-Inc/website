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
 * The part of the drawing the parks page shows.
 *
 * The full frame holds the whole street network with room to spare; the parks
 * sit inside x 110-781, y 180-1184 of it, so this is that with a margin. The
 * same drawing, closer in, which is what makes twenty markers legible rather
 * than crowded into the middle.
 */
export const PARKS_VIEW = { x: 50, y: 110, width: 790, height: 1150 } as const;

/** A crop of the drawing, in its own units. */
export type View = { x: number; y: number; width: number; height: number };

/**
 * Whether a projected point falls inside a crop.
 *
 * A marker outside the crop would be drawn beyond the edge of the picture,
 * stretching the layout for everyone, so the page leaves it off the map. It
 * still appears in the list, which is where the information actually is.
 */
export const inside = (at: { x: number; y: number }, view: View): boolean =>
  at.x >= view.x &&
  at.x <= view.x + view.width &&
  at.y >= view.y &&
  at.y <= view.y + view.height;
