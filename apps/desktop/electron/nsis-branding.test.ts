/**
 * Contract for the Windows Setup wizard skin.
 *
 * electron-builder's assisted NSIS installer falls back to the stock
 * nsis3-metro.bmp (generic blue "download" art) unless installerSidebar /
 * installerHeader are real 24-bit BMPs at MUI2's fixed sizes. These tests
 * lock that wiring and the bitmap header — not a pixel snapshot of the mark.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import { test } from 'vitest'

const DESKTOP_ROOT = path.resolve(__dirname, '..')
const DESKTOP_PKG = path.join(DESKTOP_ROOT, 'package.json')

function bmpSize(file: string): { bitCount: number; height: number; width: number } {
  const buf = fs.readFileSync(file)
  assert.equal(buf.toString('ascii', 0, 2), 'BM', `${file} must be a Windows BMP`)

  return {
    width: buf.readInt32LE(18),
    height: Math.abs(buf.readInt32LE(22)),
    bitCount: buf.readUInt16LE(28)
  }
}

function nsisConfig(): Record<string, unknown> {
  const raw = JSON.parse(fs.readFileSync(DESKTOP_PKG, 'utf8')) as {
    build?: { nsis?: Record<string, unknown> }
  }

  const nsis = raw.build?.nsis
  assert.ok(nsis && typeof nsis === 'object', 'apps/desktop package.json must declare build.nsis')

  return nsis
}

test('NSIS wizard bitmaps are 24-bit BMPs at MUI2 sizes', () => {
  const sidebar = bmpSize(path.join(DESKTOP_ROOT, 'assets/nsis/installer-sidebar.bmp'))
  const header = bmpSize(path.join(DESKTOP_ROOT, 'assets/nsis/installer-header.bmp'))
  const uninstall = bmpSize(path.join(DESKTOP_ROOT, 'assets/nsis/uninstaller-sidebar.bmp'))

  assert.deepEqual(sidebar, { width: 164, height: 314, bitCount: 24 })
  assert.deepEqual(uninstall, { width: 164, height: 314, bitCount: 24 })
  assert.deepEqual(header, { width: 150, height: 57, bitCount: 24 })
})

test('packaged NSIS config points at the branded wizard bitmaps', () => {
  const nsis = nsisConfig()

  assert.equal(nsis.installerSidebar, 'assets/nsis/installer-sidebar.bmp')
  assert.equal(nsis.uninstallerSidebar, 'assets/nsis/uninstaller-sidebar.bmp')
  assert.equal(nsis.installerHeader, 'assets/nsis/installer-header.bmp')
  assert.equal(nsis.installerIcon, 'assets/icon.ico')
  assert.equal(nsis.uninstallerIcon, 'assets/icon.ico')

  for (const rel of [
    nsis.installerSidebar,
    nsis.uninstallerSidebar,
    nsis.installerHeader,
    nsis.installerIcon,
    nsis.uninstallerIcon
  ]) {
    assert.equal(typeof rel, 'string')
    assert.ok(fs.existsSync(path.join(DESKTOP_ROOT, String(rel))), `missing ${rel}`)
  }
})
