/**
 * Génère les assets PNG requis par Expo pour le build EAS.
 * Exécuter avec : node generate-assets.js
 * Les images sont des placeholders bleus (#1D4ED8) — à remplacer par les vrais logos.
 */
const fs = require('fs')
const zlib = require('zlib')
const path = require('path')

function makeCrcTable() {
  const table = []
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    }
    table[n] = c
  }
  return table
}
const CRC_TABLE = makeCrcTable()

function crc32(buf) {
  let crc = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xFF]
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeB = Buffer.from(type, 'ascii')
  const crcVal = Buffer.alloc(4)
  crcVal.writeUInt32BE(crc32(Buffer.concat([typeB, data])), 0)
  return Buffer.concat([len, typeB, data, crcVal])
}

function createPNG(width, height, r, g, b) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8  // bit depth
  ihdr[9] = 2  // color type: RGB

  const rowSize = width * 3 + 1
  const raw = Buffer.alloc(rowSize * height)
  for (let y = 0; y < height; y++) {
    raw[y * rowSize] = 0 // filter: None
    for (let x = 0; x < width; x++) {
      const i = y * rowSize + 1 + x * 3
      raw[i] = r; raw[i + 1] = g; raw[i + 2] = b
    }
  }

  const idat = zlib.deflateSync(raw, { level: 1 })
  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

const dir = path.join(__dirname, 'assets')
fs.mkdirSync(dir, { recursive: true })

// Bleu Obaid Taxi #1D4ED8 = rgb(29, 78, 216)
const [R, G, B] = [29, 78, 216]

fs.writeFileSync(path.join(dir, 'icon.png'),              createPNG(1024, 1024, R, G, B))
fs.writeFileSync(path.join(dir, 'adaptive-icon.png'),     createPNG(1024, 1024, R, G, B))
fs.writeFileSync(path.join(dir, 'splash.png'),            createPNG(1284, 2778, R, G, B))
fs.writeFileSync(path.join(dir, 'notification-icon.png'), createPNG(96,   96,  255, 255, 255))

console.log('✅ Assets créés dans apps/mobile/assets/')
console.log('   → icon.png (1024x1024)')
console.log('   → adaptive-icon.png (1024x1024)')
console.log('   → splash.png (1284x2778)')
console.log('   → notification-icon.png (96x96)')
console.log('')
console.log('⚠️  Ces images sont des placeholders bleus.')
console.log('   Remplace-les par tes vrais logos avant la publication sur les stores.')
