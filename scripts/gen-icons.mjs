/**
 * Generates the CASHY PWA icons (PNG 192/512 + maskable) with ZERO dependencies:
 * raw RGBA pixel buffer → scanlines → zlib → PNG chunks with CRC32.
 *
 * Icon design (matches /public/icon.svg): white "C" arc on navy #0B1F3A,
 * rounded corners for "any" icons, full-bleed square for the maskable variant.
 *
 * Usage: node scripts/gen-icons.mjs   (or: npm run icons)
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "public", "icons");

// ---------- PNG encoding (IHDR/IDAT/IEND, filter 0) ----------

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

const NAVY = [11, 31, 58, 255]; // #0B1F3A (theme color)
const WHITE = [255, 255, 255, 255];
const CLEAR = [0, 0, 0, 0];

const CX = 0.5, CY = 0.5; // arc center
const R = 0.234; // ring radius (15/64)
const HALF_W = 0.055; // stroke half-width (3.5/64)
const WEDGE = (39 * Math.PI) / 180; // opening half-angle toward +x (endpoints at ±38.4°)

// cap endpoints (44,22.5) and (44,41.5) relative to center (32,32), normalized by 64
const CAP1 = [12 / 64, -9.5 / 64];
const CAP2 = [12 / 64, 9.5 / 64];

function isWhiteC(u, v) {
  const dx = u - CX;
  const dy = v - CY;
  const dist = Math.hypot(dx, dy);
  // ring segment: keep everything except the +x wedge
  const angle = Math.atan2(dy, dx);
  if (Math.abs(angle) < WEDGE) return false;
  if (Math.abs(dist - R) <= HALF_W) return true;
  // round caps at both endpoints
  const d1 = Math.hypot(u - (CX + CAP1[0]), v - (CY + CAP1[1]));
  const d2 = Math.hypot(u - (CX + CAP2[0]), v - (CY + CAP2[1]));
  return d1 <= HALF_W || d2 <= HALF_W;
}

function draw(size, { rounded }) {
  const px = Buffer.alloc(size * size * 4);
  const radius = 0.219 * size; // ≈14/64 rounded corners (matches icon.svg rx)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      let color = isWhiteC((x + 0.5) / size, (y + 0.5) / size) ? WHITE : NAVY;
      let r = color[0], g = color[1], b = color[2], a = color[3];
      if (rounded) {
        // transparent outside the rounded rect
        const cx = Math.min(Math.max(x + 0.5, radius), size - radius);
        const cy = Math.min(Math.max(y + 0.5, radius), size - radius);
        if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) > radius) {
          r = CLEAR[0]; g = CLEAR[1]; b = CLEAR[2]; a = CLEAR[3];
        }
      }
      px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a;
    }
  }
  return px;
}

mkdirSync(OUT_DIR, { recursive: true });
const targets = [
  ["icon-192.png", 192, true],
  ["icon-512.png", 512, true],
  ["icon-maskable-512.png", 512, false], // full-bleed for maskable crops
];
for (const [name, size, rounded] of targets) {
  const png = encodePng(size, size, draw(size, { rounded }));
  writeFileSync(path.join(OUT_DIR, name), png);
  console.log(`public/icons/${name} — ${size}x${size} (${png.length} bytes)`);
}
