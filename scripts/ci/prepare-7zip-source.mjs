#!/usr/bin/env node
// Stage the unchanged upstream source and binary notice beside the installer.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const sourceUrl = 'https://github.com/ip7z/7zip/releases/download/24.09/7z2409-src.7z'
const sourceSha256 = 'a33569eed0ce628fb9ceb9f46ac257d3f36b3966471667e65ba01878673c9faa'
const licenseSha256 = 'd34a018bd862e4eb96d5995a06b7d922b32f37f3006a647b488e07dfbca18895'
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')

async function main() {
  assert(process.argv.length === 3, 'Usage: node scripts/ci/prepare-7zip-source.mjs OUTPUT_DIRECTORY')
  const destination = path.resolve(process.argv[2])
  // Git may normalize this text on checkout; reproduce the upstream CRLF bytes.
  const license = Buffer.from((await fs.readFile(
    new URL('./licenses/7zip-24.09.txt', import.meta.url), 'utf8',
  )).replace(/\r?\n/g, '\r\n'))
  assert.equal(sha256(license), licenseSha256, 'The upstream 7-Zip Extra notice was modified')
  const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(60_000) })
  assert(response.ok, `7-Zip source download failed: HTTP ${response.status}`)
  const source = Buffer.from(await response.arrayBuffer())
  assert.equal(source.length, 1_498_342, 'Unexpected 7-Zip source archive size')
  assert.equal(sha256(source), sourceSha256, '7-Zip source checksum mismatch')
  await fs.mkdir(destination, { recursive: true })
  await fs.writeFile(path.join(destination, '7z2409-src.7z'), source)
  await fs.writeFile(path.join(destination, '7zip-24.09-license.txt'), license)
  console.log(`Staged verified 7-Zip 24.09 source and notice in ${destination}`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main()
}
