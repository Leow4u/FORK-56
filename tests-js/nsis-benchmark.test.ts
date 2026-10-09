import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, test } from 'vitest'

import { archiveEntries, benchmarkConfig, cleanupScratch, extractionToolVersion, inventoryTree, parseArgs, validatePayload } from '../scripts/ci/prepare-nsis-benchmark.mjs'

const folders: string[] = []
afterEach(() => {
  for (const folder of folders.splice(0)) {fs.rmSync(folder, { recursive: true, force: true })}
})

function temporary() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'nsis-benchmark-'))
  folders.push(folder)

  return folder
}

test('extraction requires the full NSIS reader and records its reported version', () => {
  const version = '7-Zip 24.09 (x64) : Copyright (c) 1999-2024 Igor Pavlov'
  assert.equal(extractionToolVersion(`${version}\nFormats:\n  Nsis nsis\n`), version)
  assert.throws(() => extractionToolVersion(`${version}\nFormats:\n  7z 7z\n  zip zip\n`), /NSIS archive reader/)
})

test('cleanup removes only owned scratch trees and leaves source, results and linked destinations intact', () => {
  const root = temporary()
  const outside = temporary()
  fs.writeFileSync(path.join(outside, 'source.exe'), 'verified source')

  for (const name of ['app', 'archives', 'builder-cache', 'tmp']) {
    fs.mkdirSync(path.join(root, name))
    fs.writeFileSync(path.join(root, name, 'scratch'), '123')
  }

  fs.symlinkSync(outside, path.join(root, 'tmp', 'linked'), process.platform === 'win32' ? 'junction' : 'dir')

  for (const name of ['7z', 'zip']) {
    fs.mkdirSync(path.join(root, name))
    fs.writeFileSync(path.join(root, name, 'installer.exe'), 'keep')
  }

  fs.writeFileSync(path.join(root, 'payload-inventory.json'), 'keep')
  fs.writeFileSync(path.join(root, 'benchmark-manifest.json'), 'keep')
  const result = cleanupScratch(root)
  assert.equal(result.freedScratchBytes, 12)
  assert.deepEqual(result.removedRelativePaths, ['app', 'archives', 'builder-cache', 'tmp'])
  assert.deepEqual(fs.readdirSync(root).sort(), ['7z', 'benchmark-manifest.json', 'payload-inventory.json', 'zip'])
  assert.equal(fs.readFileSync(path.join(outside, 'source.exe'), 'utf8'), 'verified source')
  assert.deepEqual(cleanupScratch(root), { removedRelativePaths: [], freedScratchBytes: 0 })
})

test('arguments require pinned source identities and unique known options', () => {
  const args = ['--installer', 'release with spaces.exe', '--sha256', 'a'.repeat(64), '--commit', 'b'.repeat(40), '--out', 'benchmark']
  const parsed = parseArgs(args)
  assert.equal(parsed.installer, path.resolve('release with spaces.exe'))
  assert.equal(parsed.out, path.resolve('benchmark'))
  assert.equal(parsed.candidate, '7z-direct')
  assert.equal(parseArgs([...args, '--candidate', 'zip']).candidate, 'zip')
  assert.equal(parseArgs([...args, '--candidate', '7z-direct']).candidate, '7z-direct')

  for (const invalid of [args.slice(0, 6), [...args, '--commit', 'b'.repeat(40)],
    [...args, '--unknown', 'value'], [...args, '--candidate', '7z'],
    [...args, '--candidate', 'zip', '--candidate', '7z-direct'],
    ['--installer', 'x', '--sha256', 'short', '--commit', 'b'.repeat(40), '--out', 'x']]) {
    assert.throws(() => parseArgs(invalid))
  }
})

test('variants preserve normal NSIS settings, source version and payload while disabling build hooks and signing', () => {
  const original = JSON.parse(fs.readFileSync(new URL('../apps/desktop/package.json', import.meta.url), 'utf8')).build
  const snapshot = structuredClone(original)
  const common = { output: temporary(), version: '0.0.256' }
  const baseline = benchmarkConfig(original, { ...common, variant: '7z' })
  const candidate = benchmarkConfig(original, { ...common, variant: 'zip' })
  const direct = benchmarkConfig(original, { ...common, variant: '7z-direct' })
  assert.deepEqual(original, snapshot)
  assert.deepEqual(baseline.nsis, { ...original.nsis, useZip: false, differentialPackage: true })
  assert.deepEqual(candidate.nsis, { ...original.nsis, useZip: true, differentialPackage: false })
  assert.deepEqual(direct.nsis, baseline.nsis)
  assert.equal(direct.artifactName, 'Work4You-Benchmark-7z-direct.exe')
  assert.deepEqual(candidate.extraResources, original.extraResources)
  assert.equal(candidate.extraMetadata.version, common.version)
  assert.equal(baseline.extraMetadata.version, common.version)

  for (const config of [baseline, candidate, direct]) {
    for (const hook of ['beforeBuild', 'beforePack', 'afterPack', 'afterSign', 'afterAllArtifactBuild']) {assert.equal(config[hook], null)}
    assert.equal(config.win.signExecutable, false)
    assert.equal(config.publish, null)
    assert.equal(config.forceCodeSigning, false)
    assert.equal(config.appId, original.appId)
  }
})

test('inventory proves contents and filenames rather than timestamps or traversal order', async () => {
  const root = temporary()
  fs.mkdirSync(path.join(root, 'sub'))
  fs.writeFileSync(path.join(root, 'z.txt'), 'last')
  fs.writeFileSync(path.join(root, 'sub', 'á.txt'), 'unicode')
  fs.writeFileSync(path.join(root, 'a.txt'), 'first')
  const original = await inventoryTree(root)
  assert.deepEqual(original.files.map(file => file.path), ['a.txt', 'sub/á.txt', 'z.txt'])
  assert.equal(original.totalBytes, Buffer.byteLength('lastunicodefirst'))
  assert.equal(original.fingerprintSha256, createHash('sha256').update(JSON.stringify(original.files)).digest('hex'))
  fs.utimesSync(path.join(root, 'a.txt'), new Date(0), new Date(0))
  assert.equal((await inventoryTree(root)).fingerprintSha256, original.fingerprintSha256)
  fs.writeFileSync(path.join(root, 'a.txt'), 'FIRST')
  assert.notEqual((await inventoryTree(root)).fingerprintSha256, original.fingerprintSha256)
  fs.writeFileSync(path.join(root, 'a.txt'), 'first')
  fs.renameSync(path.join(root, 'z.txt'), path.join(root, 'renamed.txt'))
  assert.notEqual((await inventoryTree(root)).fingerprintSha256, original.fingerprintSha256)
})

test('inventory refuses real links instead of following files outside the payload', async () => {
  const root = temporary()
  const outside = temporary()
  fs.writeFileSync(path.join(outside, 'external.txt'), 'external')
  fs.symlinkSync(outside, path.join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir')
  await assert.rejects(inventoryTree(root), /links are not supported/)
})

test('archive members accept nested NSIS payloads but reject traversal, absolute paths and links', () => {
  assert.deepEqual(archiveEntries('Path = $PLUGINSDIR\\app-64.7z\r\nSize = 42\r\n\r\nPath = resources/icon.ico\r\nSize = 2\r\n'),
    ['$PLUGINSDIR/app-64.7z', 'resources/icon.ico'])

  for (const name of ['../escape', '/absolute', 'C:\\escape', 'a/../../escape', 'file:stream']) {
    assert.throws(() => archiveEntries(`Path = ${name}\nSize = 2\n`), /Unsafe archive path/)
  }

  assert.throws(() => archiveEntries('Path = link\nSymbolic Link = ../../outside\n'), /Archive link/)
  assert.throws(() => archiveEntries('no entries'), /no entries/)
})

test('payload validation requires matching shell/runtime commits and existing executable assets', () => {
  const root = temporary()
  const commit = 'b'.repeat(40)
  fs.mkdirSync(path.join(root, 'resources/runtime/python'), { recursive: true })
  fs.writeFileSync(path.join(root, 'resources/install-stamp.json'), JSON.stringify({ commit }))
  const manifestFile = path.join(root, 'resources/runtime/manifest.json')
  const manifest = { commit, present: true, layout: 'app-owned', pythonExecutable: 'python/python.exe' }
  fs.writeFileSync(manifestFile, JSON.stringify(manifest))

  for (const file of ['Work4You.exe', 'resources/app.asar', 'resources/elevate.exe', 'resources/runtime/python/python.exe']) {
    fs.writeFileSync(path.join(root, file), 'MZ fixture')
  }

  validatePayload(root, commit)
  assert.throws(() => validatePayload(root, 'c'.repeat(40)), /source commit/)
  fs.writeFileSync(manifestFile, JSON.stringify({ ...manifest, pythonExecutable: '../../external.exe' }))
  assert.throws(() => validatePayload(root, commit), /inside the payload/)
  fs.writeFileSync(manifestFile, JSON.stringify(manifest))
  fs.rmSync(path.join(root, 'resources/elevate.exe'))
  assert.throws(() => validatePayload(root, commit))
})
