import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { assessResults, inspectFixture, type ProbeObservation } from '../scripts/ci/probe-nsis-unzip.mjs'

const directories: string[] = []
afterEach(() => { for (const directory of directories.splice(0)) {fs.rmSync(directory, { recursive: true, force: true })} })

const successful: ProbeObservation = {
  expected: 'success', exitCode: 0, exited: true, timedOut: false, sentinel: true, integrity: true,
}

const rejected: ProbeObservation = {
  expected: 'failure', exitCode: 2, exited: true, timedOut: false,
  sentinel: false, integrity: false, faultEstablished: true,
}

describe('native NSIS ZIP observation assessment', () => {
  it('requires both integrity/recovery success and explicitly rejected faults for readiness', () => {
    expect(assessResults([successful, rejected, successful, rejected])).toEqual({
      conclusive: true, readyForProduction: true,
    })
  })

  it('retains a conclusively observed silent hang as a production blocker', () => {
    expect(assessResults([successful, { ...rejected, timedOut: true, exitCode: 1 }, successful, rejected])).toEqual({
      conclusive: true, readyForProduction: false,
    })
  })

  it('rejects a zero-exit partial extraction even when the macro writes its completion marker', () => {
    expect(assessResults([successful, { ...rejected, exitCode: 0, sentinel: true }, successful, rejected])).toEqual({
      conclusive: true, readyForProduction: false,
    })
  })

  it('does not mistake process exit or a completion marker for full success', () => {
    expect(assessResults([successful, rejected, { ...successful, integrity: false }, rejected])).toEqual({
      conclusive: false, readyForProduction: false,
    })
  })

  it('requires the actual fault to be established and the observed process to terminate', () => {
    for (const invalid of [{ ...rejected, faultEstablished: false }, { ...rejected, exited: false },
      { ...rejected, harnessError: 'lock helper failed' }]) {
      expect(assessResults([successful, invalid, successful, rejected]).conclusive).toBe(false)
    }
  })

  it('checks every expected byte on disk including Unicode, absent and blocked directory entries', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nsis-fixture-'))
    directories.push(directory)
    fs.mkdirSync(path.join(directory, 'ação 工作'))
    fs.writeFileSync(path.join(directory, 'ação 工作/file.txt'), 'expected', 'utf8')
    fs.writeFileSync(path.join(directory, 'collision'), 'not a directory', 'utf8')

    const result = inspectFixture(directory, [
      { name: 'ação 工作/file.txt', contents: 'expected' },
      { name: 'collision/child.txt', contents: 'expected' },
      { name: 'missing.txt', contents: 'expected' },
    ])

    expect(result.map(file => file.matches)).toEqual([true, false, false])
    fs.writeFileSync(path.join(directory, 'ação 工作/file.txt'), 'corrupt', 'utf8')
    expect(inspectFixture(directory, [{ name: 'ação 工作/file.txt', contents: 'expected' }])[0].matches).toBe(false)
  })
})
