/**
 * Unpack the slim Windows chrome zip in-process, before the app quits.
 *
 * Expand-Archive in the hidden handoff is why a "shell only" update sat
 * on a blank desktop for minutes — the user sees nothing and uninstalls.
 * Inflate here (zlib) with progress, then the handoff only overlays and
 * relaunches.
 */

import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

export const WINDOWS_CHROME_EXE = 'Work4You.exe'

const EOCD_SIG = 0x06054b50
const CD_SIG = 0x02014b50
const ZIP64_U32 = 0xffffffff

export interface ExtractChromeZipProgress {
  done: number
  total: number
}

export interface ExtractChromeZipOpts {
  onProgress?: (progress: ExtractChromeZipProgress) => void
  /** Yield to the event loop so the applying overlay can paint. */
  yieldEvery?: number
}

function readU16(buf: Buffer, offset: number): number {
  return buf.readUInt16LE(offset)
}

function readU32(buf: Buffer, offset: number): number {
  return buf.readUInt32LE(offset)
}

function findEocd(buf: Buffer): number {
  const min = Math.max(0, buf.length - 22 - 0xffff)

  for (let i = buf.length - 22; i >= min; i--) {
    if (readU32(buf, i) === EOCD_SIG) {
      return i
    }
  }

  throw new Error('chrome zip is missing the end-of-central-directory record')
}

export function resolveZipEntryPath(destDir: string, rawName: string): string {
  const rel = rawName.replace(/\\/g, '/').replace(/^\/+/, '')

  if (!rel || rel.split('/').includes('..') || /^[A-Za-z]:/.test(rel) || rel.startsWith('//')) {
    throw new Error(`refusing zip path: ${rawName}`)
  }

  const root = path.resolve(destDir)
  const dest = path.resolve(root, rel)

  if (dest !== root && !dest.startsWith(root + path.sep)) {
    throw new Error(`refusing zip path: ${rawName}`)
  }

  return dest
}

function inflateEntry(method: number, compressed: Buffer, name: string): Buffer {
  if (method === 0) {
    return compressed
  }

  if (method === 8) {
    return zlib.inflateRawSync(compressed)
  }

  throw new Error(`unsupported zip method ${method} for ${name}`)
}

export function assertExtractedWindowsChrome(dir: string): void {
  const exe = path.join(dir, WINDOWS_CHROME_EXE)

  if (!fs.existsSync(exe) || !fs.statSync(exe).isFile()) {
    throw new Error(`unpacked chrome is missing ${WINDOWS_CHROME_EXE}`)
  }
}

export async function extractChromeZip(
  zipPath: string,
  destDir: string,
  opts: ExtractChromeZipOpts = {}
): Promise<void> {
  const zip = await fs.promises.readFile(zipPath)
  const eocd = findEocd(zip)
  const cdOff = readU32(zip, eocd + 16)
  const entryCount = readU16(zip, eocd + 10)

  if (cdOff === ZIP64_U32 || entryCount === 0xffff) {
    throw new Error('chrome zip uses zip64; refusing to unpack')
  }

  await fs.promises.mkdir(destDir, { recursive: true })

  type Pending = {
    name: string
    method: number
    compSize: number
    localOff: number
  }
  const files: Pending[] = []
  let cursor = cdOff

  for (let i = 0; i < entryCount; i++) {
    if (readU32(zip, cursor) !== CD_SIG) {
      throw new Error('chrome zip central directory is corrupt')
    }

    const method = readU16(zip, cursor + 10)
    const flags = readU16(zip, cursor + 8)
    const compSize = readU32(zip, cursor + 20)
    const nameLen = readU16(zip, cursor + 28)
    const extraLen = readU16(zip, cursor + 30)
    const commentLen = readU16(zip, cursor + 32)
    const localOff = readU32(zip, cursor + 42)
    const name = zip.subarray(cursor + 46, cursor + 46 + nameLen).toString('utf8')
    cursor += 46 + nameLen + extraLen + commentLen

    if (!name || name.endsWith('/')) {
      continue
    }

    if (flags & 0x1) {
      throw new Error(`encrypted zip entry: ${name}`)
    }

    if (compSize === ZIP64_U32 || localOff === ZIP64_U32) {
      throw new Error(`zip64 entry: ${name}`)
    }

    files.push({ name, method, compSize, localOff })
  }

  const yieldEvery = opts.yieldEvery ?? 16

  for (let i = 0; i < files.length; i++) {
    const entry = files[i]
    const dest = resolveZipEntryPath(destDir, entry.name)
    const locNameLen = readU16(zip, entry.localOff + 26)
    const locExtra = readU16(zip, entry.localOff + 28)
    const dataStart = entry.localOff + 30 + locNameLen + locExtra
    const compressed = zip.subarray(dataStart, dataStart + entry.compSize)
    const data = inflateEntry(entry.method, compressed, entry.name)
    await fs.promises.mkdir(path.dirname(dest), { recursive: true })
    await fs.promises.writeFile(dest, data)
    opts.onProgress?.({ done: i + 1, total: files.length })

    if ((i + 1) % yieldEvery === 0) {
      await new Promise<void>(resolve => setImmediate(resolve))
    }
  }
}
