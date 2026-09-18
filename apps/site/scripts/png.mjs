/**
 * Just enough PNG to read the aerial photograph in park-positions.mjs.
 *
 * Decoding a PNG needs nothing but zlib, which Node ships, so this saves an
 * image-library dependency for the one script that wants pixels.
 */
import { inflateSync } from "node:zlib";

const CHANNELS = { 0: 1, 2: 3, 4: 2, 6: 4 };

/**
 * Decode a non-interlaced 8-bit PNG.
 *
 * @param {Buffer} bytes
 * @returns {{ width: number, height: number, rgb: Buffer }} three bytes per
 *   pixel, row major; grayscale is expanded so callers need only one shape.
 */
export function decodePng(bytes) {
  if (bytes.readUInt32BE(0) !== 0x89504e47) throw new Error("not a PNG");
  let width = 0;
  let height = 0;
  let channels = 0;
  const parts = [];
  for (let at = 8; at < bytes.length;) {
    const length = bytes.readUInt32BE(at);
    const tag = bytes.toString("ascii", at + 4, at + 8);
    const body = bytes.subarray(at + 8, at + 8 + length);
    if (tag === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      if (body[8] !== 8) throw new Error(`unsupported bit depth ${body[8]}`);
      if (body[12] !== 0) throw new Error("interlaced PNGs are not supported");
      channels = CHANNELS[body[9]];
      if (!channels) throw new Error(`unsupported color type ${body[9]}`);
    } else if (tag === "IDAT") parts.push(body);
    else if (tag === "IEND") break;
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(parts));
  const stride = width * channels;
  const rgb = Buffer.alloc(width * height * 3);
  let above = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = Buffer.from(
      raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)),
    );
    // Undo the per-row filter, which predicts each byte from its neighbors.
    for (let i = 0; i < stride; i++) {
      const left = i >= channels ? line[i - channels] : 0;
      const up = above[i];
      const upLeft = i >= channels ? above[i - channels] : 0;
      if (filter === 1) line[i] = (line[i] + left) & 0xff;
      else if (filter === 2) line[i] = (line[i] + up) & 0xff;
      else if (filter === 3) line[i] = (line[i] + ((left + up) >> 1)) & 0xff;
      else if (filter === 4) {
        const guess = left + up - upLeft;
        const dl = Math.abs(guess - left);
        const du = Math.abs(guess - up);
        const dul = Math.abs(guess - upLeft);
        line[i] =
          (line[i] + (dl <= du && dl <= dul ? left : du <= dul ? up : upLeft)) &
          0xff;
      } else if (filter !== 0) throw new Error(`bad row filter ${filter}`);
    }
    for (let x = 0; x < width; x++) {
      const from = x * channels;
      const to = (y * width + x) * 3;
      if (channels >= 3) {
        rgb[to] = line[from];
        rgb[to + 1] = line[from + 1];
        rgb[to + 2] = line[from + 2];
      } else {
        rgb[to] = rgb[to + 1] = rgb[to + 2] = line[from];
      }
    }
    above = line;
  }
  return { width, height, rgb };
}
