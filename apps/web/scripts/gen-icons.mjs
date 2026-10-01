/**
 * Generates the PWA icons (192/512 PNG) with zero dependencies:
 * raw RGBA pixel buffer → scanlines → zlib → PNG chunks with CRC32.
 *
 * Icon: white balance scale (ميزان) on teal — draw() renders it at any size.
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "public", "icons");

// ---------- PNG encoding ----------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // scanlines with filter byte 0
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const idat = deflateSync(raw, { level: 9 });

  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

// ---------- Drawing ----------

const TEAL = [15, 118, 110, 255]; // #0f766e
const WHITE = [255, 255, 255, 255];

function makeCanvas(size) {
  const px = Buffer.alloc(size * size * 4);
  const set = (x, y, [r, g, b, a]) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
    px[i + 3] = a;
  };
  const rect = (x0, y0, x1, y1, color) => {
    const ax0 = Math.round(x0 * size);
    const ax1 = Math.round(x1 * size);
    const ay0 = Math.round(y0 * size);
    const ay1 = Math.round(y1 * size);
    for (let y = ay0; y < ay1; y++) for (let x = ax0; x < ax1; x++) set(x, y, color);
  };
  const circle = (cx, cy, r, color) => {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (x + 0.5) / size - cx;
        const dy = (y + 0.5) / size - cy;
        if (dx * dx + dy * dy <= r * r) set(x, y, color);
      }
    }
  };
  // symmetric bowl: widest at topY, narrowest at botY (pans of the scale)
  const bowl = (cx, topY, botY, topHalf, botHalf, color) => {
    const ay0 = Math.round(topY * size);
    const ay1 = Math.round(botY * size);
    for (let y = ay0; y < ay1; y++) {
      const f = (y - ay0) / Math.max(1, ay1 - ay0);
      const half = (topHalf + (botHalf - topHalf) * f) * size;
      const c = cx * size;
      for (let x = Math.round(c - half); x < Math.round(c + half); x++) set(x, y, color);
    }
  };
  return { px, rect, circle, bowl };
}

function draw(size) {
  const { px, rect, circle, bowl } = makeCanvas(size);
  rect(0, 0, 1, 1, TEAL); // background

  // balance scale
  rect(0.485, 0.24, 0.515, 0.72, WHITE); // vertical post
  rect(0.35, 0.72, 0.65, 0.775, WHITE); // base
  rect(0.42, 0.68, 0.58, 0.72, WHITE); // base neck
  rect(0.19, 0.27, 0.81, 0.305, WHITE); // beam
  circle(0.5, 0.235, 0.035, WHITE); // top knob
  rect(0.243, 0.305, 0.257, 0.44, WHITE); // left hanger
  rect(0.743, 0.305, 0.757, 0.44, WHITE); // right hanger
  bowl(0.25, 0.44, 0.51, 0.085, 0.03, WHITE); // left pan
  bowl(0.75, 0.44, 0.51, 0.085, 0.03, WHITE); // right pan

  return px;
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of [192, 512]) {
  const png = encodePng(size, size, draw(size));
  writeFileSync(path.join(OUT_DIR, `icon-${size}.png`), png);
  console.log(`icons/icon-${size}.png (${png.length} bytes)`);
}
