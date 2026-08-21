'use strict'

// Generates desktop/assets/tray.png (32x32 RGBA): the brand dot motif used by
// the wizard — a filled accent-blue disc with a small white core. Pure Node,
// no dependencies. Re-run with: node scripts/gen-tray-icon.js

const fs = require('node:fs')
const path = require('node:path')
const zlib = require('node:zlib')

const SIZE = 32
const CENTER = (SIZE - 1) / 2
const R_OUTER = 13.5
const R_INNER = 4.0
const BLUE = [77, 124, 254] // matches the default accent #4d7cfe
const WHITE = 255

function coverage(x, y) {
  // 2x2 supersampling for a smooth edge; returns blue/white coverage in 0..1.
  let blue = 0
  let white = 0
  for (let sy = 0; sy < 2; sy++) {
    for (let sx = 0; sx < 2; sx++) {
      const px = x + (sx + 0.5) / 2
      const py = y + (sy + 0.5) / 2
      const d = Math.hypot(px - CENTER, py - CENTER)
      if (d <= R_OUTER) {
        blue += 1
        if (d <= R_INNER) white += 1
      }
    }
  }
  return { blue: blue / 4, white: white / 4 }
}

const stride = SIZE * 4 + 1
const raw = Buffer.alloc(stride * SIZE)
for (let y = 0; y < SIZE; y++) {
  raw[y * stride] = 0 // filter type: none
  for (let x = 0; x < SIZE; x++) {
    const { blue, white } = coverage(x, y)
    const offset = y * stride + 1 + x * 4
    if (blue <= 0) {
      raw[offset + 3] = 0
      continue
    }
    // Composite white core over the blue disc.
    const r = Math.round(BLUE[0] * (1 - white) + WHITE * white)
    const g = Math.round(BLUE[1] * (1 - white) + WHITE * white)
    const b = Math.round(BLUE[2] * (1 - white) + WHITE * white)
    raw[offset] = r
    raw[offset + 1] = g
    raw[offset + 2] = b
    raw[offset + 3] = Math.round(255 * blue)
  }
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(zlib.crc32(Buffer.concat([typeBuf, data])) >>> 0, 0)
  return Buffer.concat([length, typeBuf, data, crc])
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(SIZE, 0)
ihdr.writeUInt32BE(SIZE, 4)
ihdr[8] = 8 // bit depth
ihdr[9] = 6 // color type: RGBA
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
])

const out = path.join(__dirname, '..', 'assets', 'tray.png')
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, png)
console.log(`wrote ${out} (${png.length} bytes)`)