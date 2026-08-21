'use strict'

// Generate build/icon.ico from the desktop assets/app-icon.png brand asset.
// electron-builder picks up build/icon.ico automatically (default buildResources).
const sharp = require('sharp')
const fs = require('node:fs')
const path = require('node:path')

async function main() {
  const src = path.join(__dirname, '..', 'assets', 'app-icon.png')
  if (!fs.existsSync(src)) throw new Error('brand asset not found: ' + src)
  const outDir = path.join(__dirname, '..', 'build')
  fs.mkdirSync(outDir, { recursive: true })

  const sizes = [16, 24, 32, 48, 64, 128, 256]
  const images = []
  for (const size of sizes) {
    const png = await sharp(src)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer()
    images.push({ size, png })
  }

  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(images.length, 4)

  const entries = []
  let offset = 6 + 16 * images.length
  for (const { size, png } of images) {
    const entry = Buffer.alloc(16)
    entry.writeUInt8(size >= 256 ? 0 : size, 0) // width (0 means 256)
    entry.writeUInt8(size >= 256 ? 0 : size, 1) // height
    entry.writeUInt8(0, 2) // color count
    entry.writeUInt8(0, 3) // reserved
    entry.writeUInt16LE(1, 4) // planes
    entry.writeUInt16LE(32, 6) // bit count
    entry.writeUInt32LE(png.length, 8)
    entry.writeUInt32LE(offset, 12)
    entries.push(entry)
    offset += png.length
  }

  const ico = Buffer.concat([header, ...entries, ...images.map((image) => image.png)])
  fs.writeFileSync(path.join(outDir, 'icon.ico'), ico)
  console.log('icon.ico written (' + ico.length + ' bytes, ' + sizes.length + ' sizes)')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
