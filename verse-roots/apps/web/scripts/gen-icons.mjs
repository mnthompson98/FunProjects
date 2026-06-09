// Generates simple PNG icons without external dependencies using raw PNG encoding
import { createWriteStream } from 'fs';
import { deflateSync } from 'zlib';
import { mkdir } from 'fs/promises';

await mkdir('public', { recursive: true });

function createPng(size) {
  // Background: sage green #4e6e52  Leaf accent: #f3efe4
  const bg = [0x4e, 0x6e, 0x52];
  const fg = [0xf3, 0xef, 0xe4];

  // Draw into raw RGBA buffer
  const pixels = new Uint8Array(size * size * 4);

  // Fill background
  for (let i = 0; i < size * size; i++) {
    pixels[i * 4 + 0] = bg[0];
    pixels[i * 4 + 1] = bg[1];
    pixels[i * 4 + 2] = bg[2];
    pixels[i * 4 + 3] = 255;
  }

  // Draw a simple leaf/seedling shape as geometric paths
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.32;

  // Circle outline (leaf shape approximated as two overlapping circles)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Outer rounded rect / circle for main body
      const inCircle = dist <= r;

      // Stem: a vertical bar from center downward
      const stemW = r * 0.12;
      const stemTop = cy + r * 0.1;
      const stemBot = cy + r * 0.85;
      const inStem = x >= cx - stemW && x <= cx + stemW && y >= stemTop && y <= stemBot;

      // Left leaf lobe: circle offset left-up
      const lx = cx - r * 0.22, ly = cy - r * 0.15, lr = r * 0.55;
      const inLeft = Math.sqrt((x - lx) ** 2 + (y - ly) ** 2) <= lr;

      // Right leaf lobe: circle offset right-up
      const rx2 = cx + r * 0.22, ry2 = cy - r * 0.15, rr = r * 0.55;
      const inRight = Math.sqrt((x - rx2) ** 2 + (y - ry2) ** 2) <= rr;

      if (inLeft || inRight || inStem) {
        const idx = (y * size + x) * 4;
        pixels[idx + 0] = fg[0];
        pixels[idx + 1] = fg[1];
        pixels[idx + 2] = fg[2];
        pixels[idx + 3] = 255;
      }
    }
  }

  // Rounded corners on background: make corners transparent
  const borderR = size * 0.22;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = Math.min(x, size - 1 - x);
      const dy = Math.min(y, size - 1 - y);
      if (dx < borderR && dy < borderR) {
        const cdx = borderR - dx;
        const cdy = borderR - dy;
        if (Math.sqrt(cdx * cdx + cdy * cdy) > borderR) {
          const idx = (y * size + x) * 4;
          pixels[idx + 3] = 0; // transparent
        }
      }
    }
  }

  return encodePng(pixels, size, size);
}

function encodePng(rgba, width, height) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  const ihdrChunk = makeChunk('IHDR', ihdr);

  // Raw image data (filter byte 0 per scanline)
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter None
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4;
      const dst = y * (width * 4 + 1) + 1 + x * 4;
      raw[dst + 0] = rgba[src + 0];
      raw[dst + 1] = rgba[src + 1];
      raw[dst + 2] = rgba[src + 2];
      raw[dst + 3] = rgba[src + 3];
    }
  }
  const compressed = deflateSync(raw);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeB = Buffer.from(type, 'ascii');
  const crc = crc32(Buffer.concat([typeB, data]));
  const crcB = Buffer.alloc(4);
  crcB.writeUInt32BE(crc >>> 0, 0);
  return Buffer.concat([len, typeB, data, crcB]);
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

for (const size of [192, 512]) {
  const png = createPng(size);
  const path = `public/pwa-icon-${size}.png`;
  const ws = createWriteStream(path);
  ws.write(png);
  ws.end();
  console.log(`Written ${path} (${png.length} bytes)`);
}

// Also write 180px apple touch icon
const apple = createPng(180);
const ws = createWriteStream('public/apple-touch-icon.png');
ws.write(apple);
ws.end();
console.log('Written public/apple-touch-icon.png');
