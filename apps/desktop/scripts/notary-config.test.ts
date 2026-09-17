import assert from 'node:assert/strict'

import { test } from 'vitest'

import {
  NOTARY_UPLOAD_TIMEOUT_SEC,
  NOTARY_WAIT_TIMEOUT_SEC,
  formatArtifactSize,
  formatNotaryFailureAdvice,
  notarytoolInfoArgs,
  notarytoolSubmitOnlyArgs,
  notarytoolWaitArgs,
  parseNotaryStatus,
  parseNotarySubmissionId,
  shouldSkipAfterSignNotarize,
} from './notary-config.mjs'
import { submitAndWaitNotary } from './notary-run.mjs'

const SUBMISSION_ID = '3b7b6623-b2c4-4f6b-8ee6-ed71db5b7c42'
const AUTH = { keyPath: '/tmp/key.p8', keyId: 'KEYID', issuer: 'ISSUER' }

test('CI afterSign skip is opt-in and off by default', () => {
  assert.equal(shouldSkipAfterSignNotarize({}), false)
  assert.equal(shouldSkipAfterSignNotarize({ WORK4YOU_SKIP_AFTERSIGN_NOTARIZE: '' }), false)
  assert.equal(shouldSkipAfterSignNotarize({ WORK4YOU_SKIP_AFTERSIGN_NOTARIZE: '0' }), false)
  assert.equal(shouldSkipAfterSignNotarize({ WORK4YOU_SKIP_AFTERSIGN_NOTARIZE: '1' }), true)
})

test('submit is upload-only; wait carries the finite Apple-processing timeout', () => {
  const submitArgs = notarytoolSubmitOnlyArgs('/tmp/Work4You.dmg', AUTH)
  assert.equal(submitArgs[0], 'notarytool')
  assert.equal(submitArgs[1], 'submit')
  assert.ok(!submitArgs.includes('--wait'))
  assert.ok(!submitArgs.includes('--timeout'))

  const waitArgs = notarytoolWaitArgs(SUBMISSION_ID, AUTH)
  assert.equal(waitArgs[1], 'wait')
  assert.equal(waitArgs[2], SUBMISSION_ID)
  assert.ok(waitArgs.includes('--timeout'))
  assert.equal(waitArgs[waitArgs.indexOf('--timeout') + 1], String(NOTARY_WAIT_TIMEOUT_SEC))

  const profileWait = notarytoolWaitArgs(SUBMISSION_ID, { profile: 'work4you' })
  assert.deepEqual(profileWait.slice(3, 5), ['--keychain-profile', 'work4you'])

  assert.ok(NOTARY_WAIT_TIMEOUT_SEC > 1200)
  assert.ok(NOTARY_WAIT_TIMEOUT_SEC < 2 * 60 * 60)
  assert.ok(NOTARY_UPLOAD_TIMEOUT_SEC > 0)
  assert.ok(NOTARY_UPLOAD_TIMEOUT_SEC + NOTARY_WAIT_TIMEOUT_SEC < 2 * 60 * 60)

  const infoArgs = notarytoolInfoArgs(SUBMISSION_ID, AUTH)
  assert.equal(infoArgs[1], 'info')
  assert.equal(infoArgs[2], SUBMISSION_ID)
})

test('parses notary submission id and status from json or labeled text', () => {
  assert.equal(
    parseNotarySubmissionId(JSON.stringify({ id: SUBMISSION_ID, status: 'In Progress' })),
    SUBMISSION_ID
  )
  assert.equal(
    parseNotarySubmissionId(
      `Timeout of 1200 second(s) was reached before processing completed.\n  id: ${SUBMISSION_ID}\n`
    ),
    SUBMISSION_ID
  )
  assert.equal(parseNotarySubmissionId('no id here'), '')
  assert.equal(
    parseNotaryStatus(JSON.stringify({ id: SUBMISSION_ID, status: 'Accepted' })),
    'Accepted'
  )
  assert.equal(parseNotaryStatus('status: In Progress\nid: other\n'), 'In Progress')
})

test('failure advice keeps the submission id and never asks for a secret', () => {
  const inProgress = formatNotaryFailureAdvice(SUBMISSION_ID, 'In Progress')
  assert.match(inProgress, new RegExp(SUBMISSION_ID))
  assert.match(inProgress, /notarytool info/)
  assert.doesNotMatch(inProgress, /APPLE_|password|--key /i)

  const invalid = formatNotaryFailureAdvice(SUBMISSION_ID, 'Invalid')
  assert.match(invalid, /notarytool log/)
  assert.equal(formatArtifactSize(1024 * 1024), '1.0 MB')
  assert.equal(formatArtifactSize(512), '512 B')
})

test('submit then wait uses the returned submission id', async () => {
  const calls: string[][] = []
  const run = async (args: string[]) => {
    calls.push(args)
    if (args[1] === 'submit') {
      return {
        stdout: JSON.stringify({ id: SUBMISSION_ID, status: 'In Progress' }),
        stderr: '',
      }
    }
    if (args[1] === 'wait') {
      assert.equal(args[2], SUBMISSION_ID)
      return {
        stdout: JSON.stringify({ id: SUBMISSION_ID, status: 'Accepted' }),
        stderr: '',
      }
    }
    throw new Error(`unexpected notarytool ${args[1]}`)
  }

  const result = await submitAndWaitNotary({
    artifactPath: '/tmp/Work4You.dmg',
    auth: AUTH,
    run,
    log: () => {},
    statFn: () => ({ size: 220_000_000 }),
  })

  assert.equal(result.submissionId, SUBMISSION_ID)
  assert.equal(result.status, 'Accepted')
  assert.equal(calls[0][1], 'submit')
  assert.ok(!calls[0].includes('--wait'))
  assert.equal(calls[1][1], 'wait')
  assert.equal(calls.length, 2)
})

test('wait timeout fetches notary info and keeps the submission id', async () => {
  const calls: string[][] = []
  const logs: string[] = []
  const run = async (args: string[]) => {
    calls.push(args)
    if (args[1] === 'submit') {
      return { stdout: `id: ${SUBMISSION_ID}\nstatus: In Progress\n`, stderr: '' }
    }
    if (args[1] === 'wait') {
      throw new Error(
        `xcrun failed: Timeout of 3600 second(s) was reached before processing completed.\n  id: ${SUBMISSION_ID}`
      )
    }
    if (args[1] === 'info') {
      return {
        stdout: JSON.stringify({ id: SUBMISSION_ID, status: 'In Progress' }),
        stderr: '',
      }
    }
    throw new Error(`unexpected notarytool ${args[1]}`)
  }

  await assert.rejects(
    () =>
      submitAndWaitNotary({
        artifactPath: '/tmp/Work4You.dmg',
        auth: AUTH,
        run,
        log: (message) => logs.push(String(message)),
        statFn: () => ({ size: 1 }),
      }),
    (error: Error) => {
      assert.match(error.message, new RegExp(SUBMISSION_ID))
      assert.match(error.message, /In Progress/)
      return true
    }
  )

  assert.equal(calls[2][1], 'info')
  assert.equal(calls[2][2], SUBMISSION_ID)
  assert.ok(logs.some((line) => line.includes('notarytool info') && line.includes(SUBMISSION_ID)))
})
