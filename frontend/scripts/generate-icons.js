// Generates minimal PNG icons for PWA from raw pixel data
// Run with: node scripts/generate-icons.js

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPNG(size) {
  // Create a simple gradient PNG with neural network dots
  const pixels = Buffer.alloc(size * size * 4);

  const cx = size / 2, cy = size / 2, r = size / 2;
  const cornerR = size * 0.1875; // rounded corner radius ratio

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;

      // Rounded rectangle check
      const inRect = isInRoundedRect(x, y, 0, 0, size, size, cornerR);

      if (inRect) {
        // Gradient from indigo to pink
        const t = (x + y) / (size * 2);
        const red = Math.round(99 + (236 - 99) * t);   // #6366f1 -> #ec4899
        const green = Math.round(102 + (72 - 102) * t);
        const blue = Math.round(241 + (153 - 241) * t);

        // Check if point is a "node" in the neural network
        const nodes = [
          [0.5, 0.5],    // center
          [0.34, 0.34],  // top-left
          [0.66, 0.34],  // top-right
          [0.30, 0.56],  // mid-left
          [0.70, 0.56],  // mid-right
          [0.42, 0.70],  // bottom-left
          [0.58, 0.70],  // bottom-right
          [0.5, 0.28],   // top-center
        ];

        let isNode = false;
        const nodeR = size * 0.04;
        const centerR = size * 0.055;
        for (let i = 0; i < nodes.length; i++) {
          const nr = i === 0 ? centerR : nodeR;
          const dx = x - nodes[i][0] * size;
          const dy = y - nodes[i][1] * size;
          if (dx * dx + dy * dy < nr * nr) {
            isNode = true;
            break;
          }
        }

        if (isNode) {
          pixels[idx] = 255;
          pixels[idx + 1] = 255;
          pixels[idx + 2] = 255;
          pixels[idx + 3] = 240;
        } else {
          pixels[idx] = red;
          pixels[idx + 1] = green;
          pixels[idx + 2] = blue;
          pixels[idx + 3] = 255;
        }
      } else {
        pixels[idx] = 0;
        pixels[idx + 1] = 0;
        pixels[idx + 2] = 0;
        pixels[idx + 3] = 0;
      }
    }
  }

  return encodePNG(pixels, size, size);
}

function isInRoundedRect(px, py, rx, ry, rw, rh, radius) {
  // Check corners
  const corners = [
    [rx + radius, ry + radius],
    [rx + rw - radius, ry + radius],
    [rx + radius, ry + rh - radius],
    [rx + rw - radius, ry + rh - radius],
  ];

  if (px < rx + radius && py < ry + radius) {
    return dist(px, py, corners[0][0], corners[0][1]) <= radius;
  }
  if (px > rx + rw - radius && py < ry + radius) {
    return dist(px, py, corners[1][0], corners[1][1]) <= radius;
  }
  if (px < rx + radius && py > ry + rh - radius) {
    return dist(px, py, corners[2][0], corners[2][1]) <= radius;
  }
  if (px > rx + rw - radius && py > ry + rh - radius) {
    return dist(px, py, corners[3][0], corners[3][1]) <= radius;
  }

  return px >= rx && px < rx + rw && py >= ry && py < ry + rh;
}

function dist(x1, y1, x2, y2) {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

function encodePNG(pixels, width, height) {
  // PNG file structure
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // IDAT chunk - raw pixel data with filter bytes
  const rawData = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    rawData[y * (1 + width * 4)] = 0; // filter: none
    pixels.copy(rawData, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const compressed = zlib.deflateSync(rawData, { level: 9 });

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeB = Buffer.from(type);
    const crcData = Buffer.concat([typeB, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(crcData) >>> 0, 0);
    return Buffer.concat([len, typeB, data, crc]);
  }

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return ~crc;
}

function createICO(pngData) {
  // ICO file format with embedded PNG
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);  // reserved
  header.writeUInt16LE(1, 2);  // type: icon
  header.writeUInt16LE(1, 4);  // count: 1

  const entry = Buffer.alloc(16);
  entry[0] = 0;    // width (0 = 256)
  entry[1] = 0;    // height (0 = 256)
  entry[2] = 0;    // color palette
  entry[3] = 0;    // reserved
  entry.writeUInt16LE(1, 4);   // color planes
  entry.writeUInt16LE(32, 6);  // bits per pixel
  entry.writeUInt32LE(pngData.length, 8);  // size
  entry.writeUInt32LE(22, 12); // offset (6 + 16)

  return Buffer.concat([header, entry, pngData]);
}

const publicDir = path.join(__dirname, '..', 'public');

// Generate PNGs
const png192 = createPNG(192);
const png512 = createPNG(512);

fs.writeFileSync(path.join(publicDir, 'icon-192.png'), png192);
fs.writeFileSync(path.join(publicDir, 'icon-512.png'), png512);

// Generate favicon.ico from a 64px PNG embedded
const png64 = createPNG(64);
const ico = createICO(png64);
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), ico);

console.log('Generated: icon-192.png, icon-512.png, favicon.ico');
