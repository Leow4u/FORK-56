import { describe, expect, it } from 'vitest'

import { assessDirectResults, type DirectObservation, parseAttemptTrace } from '../scripts/ci/probe-nsis-direct-extraction.mjs'

function observations(): DirectObservation[] {
  const success: DirectObservation = {
    name: 'unicode-success', expected: 'success', exitCode: 0, exited: true, timedOut: false,
    sentinel: true, integrity: true, attempts: [{ attempt: 1, status: '0' }],
    durationMs: 10, dialogs: [], dialogError: null, termination: null,
    stdout: '', stderr: '', harnessError: null,
  }

  const failure: DirectObservation = {
    ...success, expected: 'failure', exitCode: 2, sentinel: false, integrity: false,
    attempts: [{ attempt: 1, status: '2' }], faultEstablished: true,
  }

  return [success,
    { ...failure, name: 'permanent-lock', holderAliveAfterFailure: true, originalBytesUnchanged: true },
    { ...success, name: 'lock-recovery' },
    { ...success, name: 'transient-lock', failedWhileHeld: true, releaseDelayMs: 2001,
      attempts: [{ attempt: 1, status: '2' }, { attempt: 2, status: '0' }] },
    { ...failure, name: 'file-directory-collision' },
    { ...failure, name: 'corrupt-archive', archiveRejectedByTool: true }]
}

describe('direct extraction native evidence', () => {
  it('requires all six scenarios and their measured evidence', () => {
    expect(assessDirectResults(observations()).candidatePassed).toBe(true)
    expect(assessDirectResults(observations().slice(0, -1)).candidatePassed).toBe(false)
    const duplicate = observations()
    duplicate[5] = { ...duplicate[0] }
    expect(assessDirectResults(duplicate).conclusive).toBe(false)
  })

  it('rejects crashes, forced termination, hangs and nominal success without extraction', () => {
    for (const invalid of [{ exitCode: 1 }, { timedOut: true }, { exited: false },
      { termination: { exitCode: 0, error: null } }, { harnessError: 'spawn failed' },
      { sentinel: true }, { attempts: [] }]) {
      const cases = observations()
      cases[4] = { ...cases[4], ...invalid }
      expect(assessDirectResults(cases).candidatePassed).toBe(false)
    }
  })

  it('requires the other process to survive permanent failure and retain its original bytes', () => {
    for (const invalid of [{ holderAliveAfterFailure: false }, { originalBytesUnchanged: false }]) {
      const cases = observations()
      cases[1] = { ...cases[1], ...invalid }
      expect(assessDirectResults(cases).checks['permanent-lock']).toBe(false)
    }
  })

  it('does not accept a transient lock that never caused a failed extraction', () => {
    for (const invalid of [{ failedWhileHeld: false }, { releaseDelayMs: 1999 },
      { attempts: [{ attempt: 1, status: '0' }] },
      { attempts: [{ attempt: 1, status: 'error' }, { attempt: 2, status: '0' }] }]) {
      const cases = observations()
      cases[3] = { ...cases[3], ...invalid }
      expect(assessDirectResults(cases).checks['transient-lock']).toBe(false)
    }
  })

  it('requires extractor-confirmed archive corruption and full successful recovery', () => {
    const corrupt = observations()
    corrupt[5].archiveRejectedByTool = false
    expect(assessDirectResults(corrupt).candidatePassed).toBe(false)
    const recovery = observations()
    recovery[2].integrity = false
    expect(assessDirectResults(recovery).candidatePassed).toBe(false)
    recovery[2].integrity = true
    recovery[2].harnessError = 'invalid native observation'
    expect(assessDirectResults(recovery).candidatePassed).toBe(false)
  })

  it('reads only complete attempt records while the native process appends evidence', () => {
    expect(parseAttemptTrace('1|2\r\n2|2\n3|')).toEqual([
      { attempt: 1, status: '2' }, { attempt: 2, status: '2' },
    ])
    expect(parseAttemptTrace('1|0\r\n')).toEqual([{ attempt: 1, status: '0' }])
    expect(() => parseAttemptTrace('native garbage\n')).toThrow(/Malformed/)
  })
})
