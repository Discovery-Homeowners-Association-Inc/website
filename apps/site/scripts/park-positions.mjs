/**
 * Works out where the association's twenty parks and its shared amenities are.
 *
 * The only record of them is a hand drawing: numbered circles and lettered
 * marks on a sketch that is not to scale and is drawn with north to the left.
 * Reading pixel positions off it and calling them coordinates would be false
 * precision. So this combines the three things that are each reliable on their
 * own:
 *
 *   1. The drawing says where each park is *relative to the others*, and which
 *      streets it sits among. Those readings are the DRAWING table below.
 *   2. OpenStreetMap has surveyed positions for every street on the drawing --
 *      the same data the neighborhood map on the home page is drawn from. The
 *      street names written on the drawing are therefore control points, and
 *      fitting them gives one transform that carries the whole drawing onto
 *      the real neighborhood at once. Fitting the drawing as a whole matters:
 *      placing each park separately let neighboring parks land on each other.
 *   3. Public-domain aerial photography says where the open ground actually
 *      is. The fit alone put markers on rooftops and pavement, because the
 *      drawing is only good to a house or two. So each park finally steps to
 *      the nearest mown open ground, which is what a park is.
 *
 * Everything here is an estimate, and the parks page says so. The board
 * corrects any park by editing it in the admin app; nothing here overwrites
 * what they have entered.
 *
 *   node apps/site/scripts/park-positions.mjs
 *
 * The aerial photograph is downloaded once and cached under scripts/.cache.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { decodePng } from "./png.mjs";

/*
 * What the drawing says, read off the scan at 1700x1314 with north to the
 * left. Park numbers come from the twenty circles; the letters are the
 * drawing's own legend. The twenty circles read as exactly 1-20 with no
 * repeats and no gaps, which is the check that they were read correctly.
 */
const PARKS = [
  { number: 1, at: [1042, 770] },
  { number: 2, at: [1067, 622] },
  { number: 3, at: [1002, 613] },
  { number: 4, at: [1070, 518] },
  { number: 5, at: [1178, 295] },
  { number: 6, at: [1199, 525] },
  { number: 7, at: [1228, 607] },
  { number: 8, at: [1310, 798] },
  { number: 9, at: [1426, 792] },
  { number: 10, at: [1477, 827] },
  { number: 11, at: [1445, 915] },
  { number: 12, at: [890, 752] },
  { number: 13, at: [715, 770] },
  { number: 14, at: [785, 920] },
  { number: 15, at: [575, 811] },
  { number: 16, at: [216, 482] },
  { number: 17, at: [554, 565] },
  { number: 18, at: [936, 451] },
  { number: 19, at: [887, 592] },
  { number: 20, at: [374, 662] },
];

/*
 * What is at each park, transcribed from "Parks Description", the second page
 * of the association's park map. The board's own words, including the ones
 * marked as possibly going.
 */
const WHAT = {
  1: "Jungle gym (2019), two branches, trash can",
  2: "2 rockers and bench",
  3: "Swing set (3 seats)",
  4: "Swing set (3 seats), slide (maybe removed due to leaning to the right)",
  5: "Jungle gym, swing set (4), slide, doggie station, trash can",
  6: "Red slide, blue jungle gym",
  7: "Trash can, 2 benches, swing set (4 seats), climbing/pull up bar",
  8: "Monkey bars, swing set (2 seats), picnic table, trash can",
  9: "Basketball court, swing set (4)",
  10: "Bench, trash can, dog station, kiddie jungle gym (5 and under) (possibly removing)",
  11: "Swing set (3 seats) (possibly removing)",
  12: "Swing set (3 seats), slide",
  13: "Swing set (4 seats), basketball half court, trash can",
  14: "Trash can, bench, dog station, kiddie jungle gym (5 and under) (possibly removing), slide, swing set (4 seats) (possibly removing), rocker",
  15: "Bench, swing set (2 seats)",
  16: "Jungle gym, swings (2 seats), monkey bars, bench",
  17: "Swing set (4 seats)",
  18: "Baseball diamond, trash can, full court basketball, bike path and exercise equipment",
  19: "Swing set (4 seats), jungle gym",
  20: "Full basketball court, swing set (4 seats), metal slide, merry go round, 2 rockers, pull up bar, monkey bars and play house",
};

/*
 * The drawing's lettered legend. Two marks read F, so there are two courts.
 *
 * Two of these are unmistakable in the aerial photograph -- the water tower is
 * a white tank with a shadow, the pool is the only body of turquoise water --
 * so those two are read straight off it and are as good as the photograph.
 * The rest are placed by the fit like the parks, and inherit its error.
 */
const AMENITIES = [
  { key: "water-tower", label: "Water tower", seen: [39.470564, -77.356759] },
  { key: "pool", label: "Swimming pool", seen: [39.464136, -77.361991] },
  { key: "day-care", label: "Day care center", at: [1100, 689] },
  { key: "bath-house", label: "Bath house", at: [1156, 698] },
  { key: "pavilion", label: "Pavilion", at: [1066, 738] },
  {
    key: "basketball-rec",
    label: "Basketball court (recreation center)",
    at: [1095, 768],
  },
  {
    key: "basketball-revelation",
    label: "Basketball court (Revelation Avenue)",
    at: [1382, 776],
  },
  { key: "ballfields", label: "Ballfields", at: [830, 482] },
];

/*
 * Street names written on the drawing, against the street each names. A label
 * is written along its street, so it stands in for a point on that street;
 * the fit below moves each target onto the nearest point of the real street,
 * so the reading only has to be close.
 */
const CONTROL = [
  [[300, 410], "Imagination Court"],
  [[300, 565], "Inspiration Avenue"],
  [[206, 640], "Discovery Boulevard"],
  [[492, 525], "Adventure Avenue"],
  [[600, 630], "Adventure Court"],
  [[627, 793], "Victory Court"],
  [[630, 890], "Fortune Place"],
  [[527, 928], "Adventure Avenue"],
  [[830, 798], "Treasure Avenue"],
  [[793, 718], "Discovery Boulevard"],
  [[855, 635], "Utopia Place"],
  [[971, 632], "Eureka Lane"],
  [[989, 758], "Beacon Circle"],
  [[1053, 555], "Foresight Lane"],
  [[1017, 485], "Vision Lane"],
  [[1108, 580], "Challenge Walk"],
  [[1178, 573], "Seekers Walk"],
  [[1080, 430], "Stauffer Road"],
  [[1223, 818], "Stauffer Road"],
  [[1097, 250], "Inspiration Avenue"],
  [[1322, 460], "Curiosity Court"],
  [[1290, 617], "Discovery Boulevard"],
  [[1236, 672], "Discovery Place"],
  [[1251, 741], "Dream Place"],
  [[1316, 717], "Daring Court"],
  [[1262, 842], "Inquiry Court"],
  [[1395, 865], "Revelation Avenue"],
  [[1465, 720], "Inspiration Court"],
  [[806, 1025], "Woodsboro Pike"],
];

/** A flat metric frame centered on the neighborhood. Good to a metre here. */
const LAT0 = 39.466;
const LON0 = -77.36;
const LON_M = 111320 * Math.cos((LAT0 * Math.PI) / 180);
const LAT_M = 111132;
const toMetres = ([lat, lon]) => [(lon - LON0) * LON_M, (lat - LAT0) * LAT_M];
const toLatLon = ([x, y]) => [LAT0 + y / LAT_M, LON0 + x / LON_M];

// ---------------------------------------------------------------- the survey

const osm = JSON.parse(
  readFileSync(
    new URL(
      "../../../../discovery-homeowners-association-inc.github.io/tools/osm-roads.json",
      import.meta.url,
    ),
    "utf8",
  ),
);

/** Each named street as a list of surveyed segments, in metres. */
const streets = new Map();
/** Every surveyed segment, for measuring how far a point is off the pavement. */
const pavement = [];
for (const way of osm.elements) {
  if (!way.geometry) continue;
  const points = way.geometry.map((p) => toMetres([p.lat, p.lon]));
  for (let i = 1; i < points.length; i++)
    pavement.push([points[i - 1], points[i]]);
  const name = way.tags?.name;
  if (!name) continue;
  const list = streets.get(name) ?? [];
  for (let i = 1; i < points.length; i++) list.push([points[i - 1], points[i]]);
  streets.set(name, list);
}
for (const [, name] of CONTROL)
  if (!streets.has(name))
    throw new Error(`No street called ${name} in the survey data`);

/** The point on a segment closest to p, and how far away it is. */
function ontoSegment(p, [a, b]) {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const len = vx * vx + vy * vy;
  const t =
    len === 0
      ? 0
      : Math.max(
          0,
          Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / len),
        );
  const q = [a[0] + t * vx, a[1] + t * vy];
  return [q, Math.hypot(p[0] - q[0], p[1] - q[1])];
}

/** The point on a whole street closest to p. */
function ontoStreet(p, segments) {
  let best = null;
  for (const seg of segments) {
    const [q, d] = ontoSegment(p, seg);
    if (!best || d < best[1]) best = [q, d];
  }
  return best;
}

const offPavement = (p) => ontoStreet(p, pavement)[1];

/*
 * Streets named for the neighborhood's theme. This starts from the list the
 * map renderer uses to tell Discovery's own streets from the roads around it,
 * and adds the five that list misses: Victory, Treasure, Utopia, Vision and
 * Whimsey are all on the association's own map.
 */
const THEME = [
  "Discovery",
  "Inspiration",
  "Revelation",
  "Seekers",
  "Adventure",
  "Curiosity",
  "Daring",
  "Dream",
  "Eureka",
  "Foresight",
  "Fortune",
  "Imagination",
  "Inovation",
  "Innovation",
  "Inquiry",
  "Challenge",
  "Beacon",
  "Successful",
  "Triumphant",
  "Prosperity",
  "Venture",
  "Victory",
  "Treasure",
  "Utopia",
  "Vision",
  "Whimsey",
];
const isOurs = (name) => THEME.some((t) => name.startsWith(t));

/**
 * The named street a point is closest to. "Park 12" tells a resident nothing
 * on its own; the street it backs onto is how anyone would actually describe
 * where it is -- and they would name one of the neighborhood's own streets,
 * not the state highway it happens to sit nearest.
 */
function nearestStreet(p) {
  let best = null;
  let ours = null;
  for (const [name, segments] of streets) {
    const [, d] = ontoStreet(p, segments);
    if (!best || d < best[1]) best = [name, d];
    if (isOurs(name) && (!ours || d < ours[1])) ours = [name, d];
  }
  return (ours ?? best)[0];
}

// ------------------------------------------------- fitting the whole drawing

/**
 * Least-squares affine fit: the six numbers that carry drawing pixels onto
 * metres. Affine rather than a plain rotate-and-scale because a sketch is
 * stretched unevenly, and with control points spread over the whole drawing
 * the extra freedom earns its keep.
 */
function fitAffine(pairs) {
  // Two independent 3x3 systems, one for each output coordinate.
  const solve = (pick) => {
    const A = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];
    const rhs = [0, 0, 0];
    for (const [[dx, dy], target] of pairs) {
      const row = [dx, dy, 1];
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) A[i][j] += row[i] * row[j];
        rhs[i] += row[i] * pick(target);
      }
    }
    // Gaussian elimination with partial pivoting.
    const m = A.map((row, i) => [...row, rhs[i]]);
    for (let col = 0; col < 3; col++) {
      let pivot = col;
      for (let r = col + 1; r < 3; r++)
        if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
      [m[col], m[pivot]] = [m[pivot], m[col]];
      if (Math.abs(m[col][col]) < 1e-12)
        throw new Error("control points do not pin down a transform");
      for (let r = 0; r < 3; r++) {
        if (r === col) continue;
        const f = m[r][col] / m[col][col];
        for (let c = col; c < 4; c++) m[r][c] -= f * m[col][c];
      }
    }
    return [0, 1, 2].map((i) => m[i][3] / m[i][i]);
  };
  const ax = solve((t) => t[0]);
  const ay = solve((t) => t[1]);
  return ([dx, dy]) => [
    ax[0] * dx + ax[1] * dy + ax[2],
    ay[0] * dx + ay[1] * dy + ay[2],
  ];
}

/*
 * Fit, then let each control point slide along its own street to the place
 * the fit now points at, and fit again. A street label is written beside its
 * street rather than on it, so the first targets are all off by the width of
 * the handwriting; a few rounds of this settles that out.
 */
let place = fitAffine(
  CONTROL.map(([at, name]) => {
    const segs = streets.get(name);
    // Start from the middle of the street, the only guess available.
    const mid = segs[Math.floor(segs.length / 2)];
    return [at, [(mid[0][0] + mid[1][0]) / 2, (mid[0][1] + mid[1][1]) / 2]];
  }),
);
let residuals = [];
for (let round = 0; round < 12; round++) {
  const pairs = [];
  residuals = [];
  for (const [at, name] of CONTROL) {
    const [q, d] = ontoStreet(place(at), streets.get(name));
    pairs.push([at, q]);
    residuals.push(d);
  }
  place = fitAffine(pairs);
}
residuals.sort((a, b) => a - b);
const median = residuals[residuals.length >> 1];
console.error(
  `fit: ${CONTROL.length} street labels, off by ${median.toFixed(1)} m at the ` +
    `median, ${residuals[residuals.length - 1].toFixed(1)} m at the worst`,
);

// ---------------------------------------------------- the aerial photograph

/*
 * USGS imagery: public domain, and the same source the neighborhood map uses
 * for its base. Exported in EPSG:4326 so pixels are linear in degrees, which
 * keeps the pixel-to-coordinate arithmetic to two multiplications.
 */
const BBOX = { west: -77.366, south: 39.4605, east: -77.3545, north: 39.4715 };
const SIZE = { width: 1400, height: 1340 };
const AERIAL =
  "https://imagery.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/" +
  `ImageServer/exportImage?bbox=${BBOX.west},${BBOX.south},${BBOX.east},` +
  `${BBOX.north}&bboxSR=4326&size=${SIZE.width},${SIZE.height}` +
  "&imageSR=4326&format=png&f=image";

const cache = new URL("./.cache/aerial.png", import.meta.url);
let png;
try {
  png = readFileSync(cache);
} catch {
  console.error("fetching the aerial photograph from USGS...");
  const res = await fetch(AERIAL, {
    headers: {
      "user-agent": "dhoa-park-positions (association website build)",
    },
  });
  if (!res.ok) throw new Error(`USGS imagery: ${res.status} ${res.statusText}`);
  png = Buffer.from(await res.arrayBuffer());
  mkdirSync(new URL("./.cache/", import.meta.url), { recursive: true });
  writeFileSync(cache, png);
}

const { width: W, height: H, rgb } = decodePng(png);
if (W !== SIZE.width || H !== SIZE.height)
  throw new Error(`aerial is ${W}x${H}, expected ${SIZE.width}x${SIZE.height}`);

const DEG_X = (BBOX.east - BBOX.west) / W;
const DEG_Y = (BBOX.north - BBOX.south) / H;
const PIXEL_X = DEG_X * LON_M; // about 0.7 m
const PIXEL_Y = DEG_Y * LAT_M; // about 0.9 m
const pixelOf = ([x, y]) => {
  const [lat, lon] = toLatLon([x, y]);
  return [
    Math.round((lon - BBOX.west) / DEG_X),
    Math.round((BBOX.north - lat) / DEG_Y),
  ];
};
const metresOf = (px, py) =>
  toMetres([BBOX.north - py * DEG_Y, BBOX.west + px * DEG_X]);

/*
 * Classify every pixel as open ground, tree canopy, or built. Vegetation shows
 * as green above the other channels. What separates a mown lawn from a tree is
 * brightness and smoothness: canopy is darker and, at 0.7 m per pixel, visibly
 * textured, where grass is flat.
 */
const VEGETATION = 8; // how far green leads the red and blue channels
const BRIGHT = 100; // canopy sits below this, mown grass above
const SMOOTH = 14; // canopy's texture, as a standard deviation of brightness
const WINDOW = 3; // measured over a 7x7 pixel window

const brightness = new Int16Array(W * H);
const green = new Int16Array(W * H);
for (let p = 0; p < W * H; p++) {
  const r = rgb[p * 3];
  const g = rgb[p * 3 + 1];
  const b = rgb[p * 3 + 2];
  brightness[p] = (r + g + b) / 3;
  green[p] = g - (r + b) / 2;
}
// Summed-area tables, so the window statistics cost the same at any size.
const sum = new Float64Array((W + 1) * (H + 1));
const sumSq = new Float64Array((W + 1) * (H + 1));
for (let y = 0; y < H; y++) {
  let rowSum = 0;
  let rowSq = 0;
  for (let x = 0; x < W; x++) {
    const v = brightness[y * W + x];
    rowSum += v;
    rowSq += v * v;
    sum[(y + 1) * (W + 1) + x + 1] = sum[y * (W + 1) + x + 1] + rowSum;
    sumSq[(y + 1) * (W + 1) + x + 1] = sumSq[y * (W + 1) + x + 1] + rowSq;
  }
}
const OPEN = 2;
const kind = new Uint8Array(W * H);
for (let y = 0; y < H; y++) {
  const y0 = Math.max(0, y - WINDOW);
  const y1 = Math.min(H - 1, y + WINDOW);
  for (let x = 0; x < W; x++) {
    const p = y * W + x;
    if (green[p] < VEGETATION) continue; // built: roof, road, or bare ground
    const x0 = Math.max(0, x - WINDOW);
    const x1 = Math.min(W - 1, x + WINDOW);
    const n = (x1 - x0 + 1) * (y1 - y0 + 1);
    const box = (A) =>
      A[(y1 + 1) * (W + 1) + x1 + 1] -
      A[y0 * (W + 1) + x1 + 1] -
      A[(y1 + 1) * (W + 1) + x0] +
      A[y0 * (W + 1) + x0];
    const mean = box(sum) / n;
    const variance = box(sumSq) / n - mean * mean;
    kind[p] =
      mean >= BRIGHT && Math.sqrt(Math.max(0, variance)) <= SMOOTH ? OPEN : 1;
  }
}

/**
 * How far every pixel is from the nearest seeded pixel, in metres. A two-pass
 * chamfer sweep, weighted for the aerial's non-square pixels.
 *
 * @param {(p: number) => boolean} seeded
 */
function distanceFrom(seeded) {
  const d = new Float32Array(W * H);
  const far = 1e9;
  const diagonal = Math.hypot(PIXEL_X, PIXEL_Y);
  for (let p = 0; p < W * H; p++) d[p] = seeded(p) ? 0 : far;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      if (d[p] === 0) continue;
      let best = d[p];
      if (x > 0) best = Math.min(best, d[p - 1] + PIXEL_X);
      if (y > 0) best = Math.min(best, d[p - W] + PIXEL_Y);
      if (x > 0 && y > 0) best = Math.min(best, d[p - W - 1] + diagonal);
      if (x < W - 1 && y > 0) best = Math.min(best, d[p - W + 1] + diagonal);
      d[p] = best;
    }
  for (let y = H - 1; y >= 0; y--)
    for (let x = W - 1; x >= 0; x--) {
      const p = y * W + x;
      if (d[p] === 0) continue;
      let best = d[p];
      if (x < W - 1) best = Math.min(best, d[p + 1] + PIXEL_X);
      if (y < H - 1) best = Math.min(best, d[p + W] + PIXEL_Y);
      if (x < W - 1 && y < H - 1)
        best = Math.min(best, d[p + W + 1] + diagonal);
      if (x > 0 && y < H - 1) best = Math.min(best, d[p + W - 1] + diagonal);
      d[p] = best;
    }
  return d;
}
const openness = distanceFrom((p) => kind[p] !== OPEN);

/*
 * How far every pixel is from the pavement. The classifier already keeps a
 * marker off the road surface, but "not on the road" is not the same as "in
 * the park": a point can sit a foot from the curb and still read as being on
 * the street. Rasterizing the surveyed segments and sweeping them gives the
 * clearance cheaply, at any number of candidates.
 */
const onPavement = new Uint8Array(W * H);
for (const [a, b] of pavement) {
  const [x1, y1] = pixelOf(a);
  const [x2, y2] = pixelOf(b);
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), 1);
  for (let i = 0; i <= steps; i++) {
    const x = x1 + Math.round(((x2 - x1) * i) / steps);
    const y = y1 + Math.round(((y2 - y1) * i) / steps);
    if (x >= 0 && x < W && y >= 0 && y < H) onPavement[y * W + x] = 1;
  }
}
const clearance = distanceFrom((p) => onPavement[p] === 1);

/*
 * Step a fitted point onto open ground. The fit is good to a house or two, so
 * the search starts inside 30 m: further than that and the marker is answering
 * to the imagery rather than to the drawing. Roomier ground is preferred, but
 * only among the nearest candidates, so a park does not walk across the street
 * to a bigger lawn. The reach widens only if nothing nearby qualifies, and how
 * far each park had to go is reported, so a bad placement is visible.
 */
const REACH_M = [30, 45, 60];
const ROOMY_M = [9, 7, 5, 4];
const OFF_PAVEMENT_M = 8;

function ontoOpenGround(point) {
  const [cx, cy] = pixelOf(point);
  for (const reach of REACH_M) {
    const rx = Math.ceil(reach / PIXEL_X);
    const ry = Math.ceil(reach / PIXEL_Y);
    const near = [];
    for (let dy = -ry; dy <= ry; dy++)
      for (let dx = -rx; dx <= rx; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || x >= W || y < 0 || y >= H) continue;
        const moved = Math.hypot(dx * PIXEL_X, dy * PIXEL_Y);
        if (moved > reach) continue;
        const p = y * W + x;
        if (clearance[p] < OFF_PAVEMENT_M) continue;
        near.push([moved, openness[p], x, y]);
      }
    near.sort((a, b) => a[0] - b[0]);
    for (const want of ROOMY_M) {
      const hit = near.find(([, room]) => room >= want);
      if (hit) {
        const [moved, room, x, y] = hit;
        return { point: metresOf(x, y), moved, room, placed: true };
      }
    }
  }
  return {
    point,
    moved: 0,
    room: openness[cy * W + cx],
    placed: false,
  };
}

// --------------------------------------------------------------- the answer

const parks = PARKS.map(({ number, at }) => {
  const { point, moved, room, placed } = ontoOpenGround(place(at));
  const [lat, lon] = toLatLon(point);
  return {
    number,
    name: `Park ${number}`,
    where: `Off ${nearestStreet(point)}`,
    what: WHAT[number] ?? "",
    lat: Number(lat.toFixed(6)),
    lon: Number(lon.toFixed(6)),
    moved_m: Number(moved.toFixed(1)),
    open_radius_m: Number(room.toFixed(1)),
    off_pavement_m: Number(offPavement(point).toFixed(1)),
    placed,
  };
});

const amenities = AMENITIES.map(({ key, label, at, seen }) => {
  const [lat, lon] = seen ?? toLatLon(place(at));
  return {
    key,
    label,
    lat: Number(lat.toFixed(6)),
    lon: Number(lon.toFixed(6)),
    from: seen ? "photograph" : "drawing",
  };
});

for (const p of parks)
  console.error(
    `park ${String(p.number).padStart(2)}  ` +
      (p.placed
        ? `stepped ${p.moved_m.toFixed(1).padStart(4)} m onto ground ` +
          `${p.open_radius_m.toFixed(1).padStart(4)} m across, ` +
          `${p.off_pavement_m.toFixed(1).padStart(4)} m off the pavement`
        : "NO open ground within 60 m -- left where the drawing puts it"),
  );

console.log(JSON.stringify({ parks, amenities }, null, 2));
