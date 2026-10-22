export const LIMITS = {
  fileBytes: 10 * 1024 * 1024,
  docxUnzipBytes: 20 * 1024 * 1024,
  maxZipEntries: 2000,
  maxPdfPages: 30,
  maxImagePixels: 40_000_000,
  maxFrames: 1,
  textChars: 20000,
  outputChars: 60000,
}

export function limitError(code) {
  return Object.assign(new Error(code), { code })
}

export function addUnzipBytes(total, chunk) {
  const next = total + chunk
  if (!Number.isSafeInteger(chunk) || chunk < 0 || next > LIMITS.docxUnzipBytes) throw limitError('UNZIP_LIMIT')
  return next
}

export function notePdfPage(count) {
  if (count > LIMITS.maxPdfPages) throw limitError('PAGE_LIMIT')
  return count
}

export function assertImageHeader({ width, height, frames = 1 }) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) throw limitError('IMAGE_HEADER')
  if (!Number.isInteger(frames) || frames < 1) throw limitError('IMAGE_HEADER')
  if (frames > LIMITS.maxFrames) throw limitError('FRAME_LIMIT')
  if (width * height * frames > LIMITS.maxImagePixels) throw limitError('PIXEL_LIMIT')
  return { width, height, frames }
}

// Inspect encoded chunks, never pixels. Animated inputs are rejected rather than
// silently sending only their first frame to the vision provider.
export function imageHeaderFromBytes(buffer) {
  if (buffer.length >= 24 && buffer[0] === 0x89 && buffer.toString('ascii', 1, 4) === 'PNG') {
    let frames = 1
    for (let offset = 8; offset + 12 <= buffer.length;) {
      const size = buffer.readUInt32BE(offset)
      const type = buffer.toString('ascii', offset + 4, offset + 8)
      if (offset + 12 + size > buffer.length) throw limitError('IMAGE_HEADER')
      if (type === 'acTL' && size >= 8) frames = buffer.readUInt32BE(offset + 8)
      offset += size + 12
    }
    return assertImageHeader({ width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20), frames })
  }
  if (buffer.length >= 20 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    let width, height, frames = 0, animated = false
    for (let offset = 12; offset + 8 <= buffer.length;) {
      const size = buffer.readUInt32LE(offset + 4)
      const start = offset + 8
      if (start + size > buffer.length) throw limitError('IMAGE_HEADER')
      const type = buffer.toString('ascii', offset, offset + 4)
      if (type === 'VP8X' && size >= 10) {
        animated = Boolean(buffer[start] & 2)
        width = 1 + buffer.readUIntLE(start + 4, 3)
        height = 1 + buffer.readUIntLE(start + 7, 3)
      } else if (type === 'VP8 ' && size >= 10 && width === undefined) {
        width = buffer.readUInt16LE(start + 6) & 0x3fff
        height = buffer.readUInt16LE(start + 8) & 0x3fff
      } else if (type === 'VP8L' && size >= 5 && width === undefined) {
        const bits = buffer.readUInt32LE(start + 1)
        width = (bits & 0x3fff) + 1
        height = ((bits >>> 14) & 0x3fff) + 1
      }
      if (type === 'ANMF') frames += 1
      offset = start + size + (size & 1)
    }
    return assertImageHeader({ width, height, frames: animated ? Math.max(2, frames) : Math.max(1, frames) })
  }
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2
    while (offset + 4 <= buffer.length) {
      if (buffer[offset++] !== 0xff) break
      while (buffer[offset] === 0xff) offset += 1
      const marker = buffer[offset++]
      if (marker === 0xd9 || marker === 0xda) break
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue
      if (offset + 2 > buffer.length) break
      const size = buffer.readUInt16BE(offset)
      if (size < 2 || offset + size > buffer.length) break
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker) && size >= 8) {
        return assertImageHeader({ height: buffer.readUInt16BE(offset + 3), width: buffer.readUInt16BE(offset + 5) })
      }
      offset += size
    }
  }
  throw limitError('IMAGE_HEADER')
}

// Central-directory lengths work with data descriptors; local-header lengths do
// not. ZIP64/encrypted archives are deliberately unsupported for this small input.
export function zipEntries(buffer) {
  if (buffer.length < 22) throw limitError('DOCX_INVALID')
  let end = buffer.length - 22
  const floor = Math.max(0, end - 65535)
  while (end >= floor && buffer.readUInt32LE(end) !== 0x06054b50) end -= 1
  if (end < floor || end + 22 + buffer.readUInt16LE(end + 20) !== buffer.length) throw limitError('DOCX_INVALID')
  const count = buffer.readUInt16LE(end + 10)
  const directorySize = buffer.readUInt32LE(end + 12)
  let offset = buffer.readUInt32LE(end + 16)
  if (buffer.readUInt16LE(end + 4) || buffer.readUInt16LE(end + 6) || count > LIMITS.maxZipEntries || offset + directorySize !== end) throw limitError('DOCX_INVALID')
  const entries = []
  const names = new Set()
  let total = 0
  for (let index = 0; index < count; index += 1) {
    if (offset + 46 > end || buffer.readUInt32LE(offset) !== 0x02014b50) throw limitError('DOCX_INVALID')
    const flags = buffer.readUInt16LE(offset + 8)
    const method = buffer.readUInt16LE(offset + 10)
    const compressed = buffer.readUInt32LE(offset + 20)
    const size = buffer.readUInt32LE(offset + 24)
    const nameLength = buffer.readUInt16LE(offset + 28)
    const next = offset + 46 + nameLength + buffer.readUInt16LE(offset + 30) + buffer.readUInt16LE(offset + 32)
    const local = buffer.readUInt32LE(offset + 42)
    if (flags & 1 || ![0, 8].includes(method) || next > end || local + 30 > end || buffer.readUInt32LE(local) !== 0x04034b50) throw limitError('DOCX_INVALID')
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength)
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28)
    if (names.has(name) || start + compressed > buffer.readUInt32LE(end + 16)) throw limitError('DOCX_INVALID')
    names.add(name)
    total = addUnzipBytes(total, size)
    entries.push({ name, method, size, compressed, start })
    offset = next
  }
  if (offset !== end) throw limitError('DOCX_INVALID')
  return entries
}
