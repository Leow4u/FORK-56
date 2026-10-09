import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import {
  applyNsisDirectExtractionPatch,
  restoreNsisDirectExtractionPatch,
  transformNsisDirectExtraction,
  verifyNsisBaselineTemplate,
  verifyStandaloneSevenZip,
} from '../scripts/ci/patch-nsis-direct-extraction.mjs'

const temporary: string[] = []
const baseline = verifyNsisBaselineTemplate()
// This upstream template is the patcher's actual input fixture, not source
// inspected for implementation-shaped assertions. Native NSIS exercises it.
const original = fs.readFileSync(baseline.templatePath, 'utf8')
const helper = String.raw`C:\cache\ação 工作 $literal\bin\7za.exe`
const hash = (value: string) => createHash('sha256').update(value).digest('hex')

afterEach(() => {
  for (const directory of temporary.splice(0)) {fs.rmSync(directory, { recursive: true, force: true })}
})

function builderFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nsis-direct-patch-'))
  temporary.push(root)
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: baseline.builderVersion }))
  const templatePath = path.join(root, 'templates/nsis/include/extractAppPackage.nsh')
  fs.mkdirSync(path.dirname(templatePath), { recursive: true })
  fs.writeFileSync(templatePath, original)

  return { root, templatePath }
}

function transform(source = original, sevenZipPath = helper) {
  return transformNsisDirectExtraction({ source, builderVersion: baseline.builderVersion, sevenZipPath })
}

describe('guarded direct NSIS extraction patch', () => {
  it('patches the real upstream input idempotently and restores its exact bytes', () => {
    const fixture = builderFixture()
    const info = verifyNsisBaselineTemplate({ builderRoot: fixture.root })
    const patched = transform()
    expect(patched.alreadyApplied).toBe(false)
    expect(patched.originalSha256).toBe(hash(original))
    expect(patched.patchedSha256).toBe(hash(patched.source))
    expect(patched.patchedSha256).not.toBe(patched.originalSha256)
    expect(transform(patched.source)).toEqual({ ...patched, alreadyApplied: true })

    fs.writeFileSync(fixture.templatePath, patched.source)
    expect(() => verifyNsisBaselineTemplate({ builderRoot: fixture.root })).toThrow(/unmodified upstream/)
    restoreNsisDirectExtractionPatch({ ...info, patchedSha256: patched.patchedSha256, sevenZip: { path: helper } })
    expect(fs.readFileSync(fixture.templatePath, 'utf8')).toBe(original)
    expect(verifyNsisBaselineTemplate({ builderRoot: fixture.root })).toEqual(info)
  })

  it('refuses changed versions, templates, duplicate input and edited prior patches', () => {
    expect(() => transformNsisDirectExtraction({ source: original, builderVersion: '0.0.0', sevenZipPath: helper }))
      .toThrow(/Unsupported electron-builder/)

    for (const source of [original + '\n', original + original, '', transform().source + '\n']) {
      expect(() => transform(source)).toThrow()
    }

    expect(() => transform(transform().source, String.raw`C:\other\bin\7za.exe`)).toThrow()
  })

  it('refuses to erase a concurrent edit when restoring a patch receipt', () => {
    const fixture = builderFixture()
    const patched = transform()
    const changed = patched.source + '\n; another build changed this file\n'
    fs.writeFileSync(fixture.templatePath, changed)
    expect(() => restoreNsisDirectExtractionPatch({ ...baseline, templatePath: fixture.templatePath,
      patchedSha256: patched.patchedSha256, sevenZip: { path: helper } })).toThrow(/refusing to restore/)
    expect(fs.readFileSync(fixture.templatePath, 'utf8')).toBe(changed)
  })

  it('rejects unknown helper bytes before writing the template', async () => {
    const fixture = builderFixture()
    const executable = path.join(fixture.root, 'tool/bin/7za.exe')
    fs.mkdirSync(path.dirname(executable), { recursive: true })
    fs.writeFileSync(executable, 'unverified executable')
    expect(() => verifyStandaloneSevenZip(executable)).toThrow(/Unrecognized standalone 7-Zip/)
    await expect(applyNsisDirectExtractionPatch({ builderRoot: fixture.root, sevenZipPath: executable }))
      .rejects.toThrow(/Unrecognized standalone 7-Zip/)
    expect(fs.readFileSync(fixture.templatePath, 'utf8')).toBe(original)
  })

  it('rejects resource paths capable of escaping an NSIS source line', () => {
    for (const filename of ['relative/7za.exe', 'C:\\tool\n!include bad.nsh', 'C:\\tool\rbreak', 'C:\\tool\0break']) {
      expect(() => transform(original, filename)).toThrow(/NSIS resource path/)
    }
  })
})
