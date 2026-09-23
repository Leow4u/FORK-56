/**
 * Tests for electron/chrome-zip-extract.ts — in-process chrome zip unpack.
 *
 * Run with: npx vitest run --project electron electron/chrome-zip-extract.test.ts
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'

import { test } from 'vitest'

import {
  assertExtractedWindowsChrome,
  extractChromeZip,
  resolveZipEntryPath,
  WINDOWS_CHROME_EXE
} from './chrome-zip-extract'

function crc32(buf: Buffer): number {
  let crc = ~0

  for (const byte of buf) {
    crc ^= byte

    for (let i = 0; i < 8; i++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
  }

  return ~crc >>> 0
}

function writeLocalAndCd(opts: { name: string; data: Buffer; method: 0 | 8; compressed: Buffer }): {
  local: Buffer
  cd: Buffer
} {
  const name = Buffer.from(opts.name, 'utf8')
  const crc = crc32(opts.data)
  const local = Buffer.alloc(30 + name.length + opts.compressed.length)
  local.writeUInt32LE(0x04034b50, 0)
  local.writeUInt16LE(20, 4)
  local.writeUInt16LE(opts.method, 8)
  local.writeUInt32LE(crc, 14)
  local.writeUInt32LE(opts.compressed.length, 18)
  local.writeUInt32LE(opts.data.length, 22)
  local.writeUInt16LE(name.length, 26)
  name.copy(local, 30)
  opts.compressed.copy(local, 30 + name.length)

  const cd = Buffer.alloc(46 + name.length)
  cd.writeUInt32LE(0x02014b50, 0)
  cd.writeUInt16LE(20, 4)
  cd.writeUInt16LE(20, 6)
  cd.writeUInt16LE(opts.method, 10)
  cd.writeUInt32LE(crc, 16)
  cd.writeUInt32LE(opts.compressed.length, 20)
  cd.writeUInt32LE(opts.data.length, 24)
  cd.writeUInt16LE(name.length, 28)
  name.copy(cd, 46)

  return { local, cd }
}

function writeZip(entries: { name: string; data: Buffer; method?: 0 | 8 }[]): Buffer {
  const locals: Buffer[] = []
  const cds: Buffer[] = []
  let offset = 0

  for (const entry of entries) {
    const method = entry.method ?? 8
    const compressed = method === 0 ? entry.data : zlib.deflateRawSync(entry.data)
    const built = writeLocalAndCd({ name: entry.name, data: entry.data, method, compressed })
    built.cd.writeUInt32LE(offset, 42)
    locals.push(built.local)
    cds.push(built.cd)
    offset += built.local.length
  }

  const cd = Buffer.concat(cds)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(entries.length, 8)
  eocd.writeUInt16LE(entries.length, 10)
  eocd.writeUInt32LE(cd.length, 12)
  eocd.writeUInt32LE(offset, 16)

  return Buffer.concat([...locals, cd, eocd])
}

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'w4y-chrome-extract-'))
}

test('resolveZipEntryPath rejects zip-slip and absolute names', () => {
  const root = path.join(os.tmpdir(), 'chrome-root')
  assert.equal(resolveZipEntryPath(root, 'Work4You.exe'), path.resolve(root, 'Work4You.exe'))
  assert.equal(resolveZipEntryPath(root, 'resources/app.asar'), path.resolve(root, 'resources/app.asar'))
  assert.throws(() => resolveZipEntryPath(root, '../escape.exe'))
  assert.throws(() => resolveZipEntryPath(root, 'foo/../../escape.exe'))
  assert.throws(() => resolveZipEntryPath(root, 'C:/Windows/system32/calc.exe'))
})

test('extractChromeZip inflates stored and deflated files and reports progress', async () => {
  const dir = tmpDir()

  try {
    const zipPath = path.join(dir, 'chrome.zip')
    const out = path.join(dir, 'out')
    fs.writeFileSync(
      zipPath,
      writeZip([
        { name: WINDOWS_CHROME_EXE, data: Buffer.from('mz-exe'), method: 0 },
        { name: 'resources/app.asar', data: Buffer.from('asar-bytes'), method: 8 }
      ])
    )
    const ticks: number[] = []
    await extractChromeZip(zipPath, out, {
      yieldEvery: 1,
      onProgress: ({ done, total }) => {
        ticks.push(done)
        assert.equal(total, 2)
      }
    })
    assert.equal(fs.readFileSync(path.join(out, WINDOWS_CHROME_EXE), 'utf8'), 'mz-exe')
    assert.equal(fs.readFileSync(path.join(out, 'resources', 'app.asar'), 'utf8'), 'asar-bytes')
    assert.deepEqual(ticks, [1, 2])
    assertExtractedWindowsChrome(out)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('assertExtractedWindowsChrome fails when the exe is missing', () => {
  const dir = tmpDir()

  try {
    fs.writeFileSync(path.join(dir, 'readme.txt'), 'nope')
    assert.throws(() => assertExtractedWindowsChrome(dir), /Work4You\.exe/)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('extractChromeZip refuses a zip-slip entry', async () => {
  const dir = tmpDir()

  try {
    const zipPath = path.join(dir, 'slip.zip')
    fs.writeFileSync(zipPath, writeZip([{ name: '../escape.exe', data: Buffer.from('x'), method: 0 }]))
    await assert.rejects(() => extractChromeZip(zipPath, path.join(dir, 'out')), /refusing zip path/)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
