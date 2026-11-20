/**
 * Generates the FOCUS icon set without any image dependency.
 * Draws an open focus ring with a coral centre dot, supersampled 4x.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = resolve(ROOT, 'public/icons');
const SIZES = [16, 32, 48, 128];
const SCALE = 4;

const COLORS = {
  background: [16, 18, 16, 255],
  ring: [214, 243, 106, 255],
  dot: [255, 122, 89, 255],
};

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const payload = Buffer.concat([typeBuffer, data]);
  const out = Buffer.alloc(payload.length + 8);
  out.writeUInt32BE(data.length, 0);
  payload.copy(out, 4);
  out.writeUInt32BE(crc32(payload), payload.length + 4);
  return out;
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function roundedRectAlpha(x, y, size, radius) {
  const cx = Math.min(x, size - x);
  const cy = Math.min(y, size - y);
  if (cx >= radius || cy >= radius) return 1;
  const dx = radius - cx;
  const dy = radius - cy;
  return dx * dx + dy * dy <= radius * radius ? 1 : 0;
}

function sample(x, y, size) {
  const center = size / 2;
  const dx = x - center;
  const dy = y - center;
  const distance = Math.hypot(dx, dy);
  const ringRadius = size * 0.33;
  const ringWidth = size * 0.095;
  const angle = Math.atan2(dy, dx);
  const gap = Math.abs(angle + Math.PI / 4) < 0.42;

  let color = null;
  if (distance <= size * 0.085) {
    color = COLORS.dot;
  } else if (Math.abs(distance - ringRadius) <= ringWidth / 2 && !gap) {
    color = COLORS.ring;
  } else if (roundedRectAlpha(x, y, size, size * 0.26) === 1) {
    color = COLORS.background;
  }
  return color;
}

function render(size) {
  const width = size * SCALE;
  const rgba = Buffer.alloc(width * width * 4);
  for (let y = 0; y < width; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const color = sample(x + 0.5, y + 0.5, width);
      if (!color) continue;
      const offset = (y * width + x) * 4;
      rgba[offset] = color[0];
      rgba[offset + 1] = color[1];
      rgba[offset + 2] = color[2];
      rgba[offset + 3] = color[3];
    }
  }

  // Downsample with alpha-weighted averaging so edges stay clean.
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let alphaSum = 0;
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < SCALE; sy += 1) {
        for (let sx = 0; sx < SCALE; sx += 1) {
          const offset = ((y * SCALE + sy) * width + (x * SCALE + sx)) * 4;
          const alpha = rgba[offset + 3] / 255;
          alphaSum += alpha;
          r += rgba[offset] * alpha;
          g += rgba[offset + 1] * alpha;
          b += rgba[offset + 2] * alpha;
        }
      }
      const offset = (y * size + x) * 4;
      const alpha = alphaSum / (SCALE * SCALE);
      out[offset + 3] = Math.round(alpha * 255);
      if (alphaSum > 0) {
        out[offset] = Math.round(r / alphaSum);
        out[offset + 1] = Math.round(g / alphaSum);
        out[offset + 2] = Math.round(b / alphaSum);
      }
    }
  }
  return encodePng(size, size, out);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of SIZES) {
  const file = resolve(OUT_DIR, `icon-${size}.png`);
  writeFileSync(file, render(size));
  console.log(`wrote ${file}`);
}
