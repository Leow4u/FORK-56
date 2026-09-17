import { execFile } from 'node:child_process'
import { statSync } from 'node:fs'

import {
  NOTARY_INFO_EXEC_TIMEOUT_MS,
  NOTARY_UPLOAD_EXEC_TIMEOUT_MS,
  NOTARY_WAIT_EXEC_TIMEOUT_MS,
  NOTARY_WAIT_TIMEOUT_SEC,
  formatArtifactSize,
  formatNotaryFailureAdvice,
  notarytoolInfoArgs,
  notarytoolSubmitOnlyArgs,
  notarytoolWaitArgs,
  parseNotaryStatus,
  parseNotarySubmissionId,
} from './notary-config.mjs'

function combinedOutput({ stdout = '', stderr = '' } = {}) {
  return `${stdout}\n${stderr}`
}

export function createXcrunRunner({
  execFileFn = execFile,
  log = console.log,
  logError = console.error,
} = {}) {
  return function runXcrun(args, { timeoutMs, label = args[1] || args[0] } = {}) {
    return new Promise((resolve, reject) => {
      execFileFn('xcrun', args, { timeout: timeoutMs }, (error, stdout, stderr) => {
        const out = String(stdout || '')
        const err = String(stderr || '')
        if (out.trim()) log(out.trimEnd())
        if (err.trim()) logError(err.trimEnd())
        if (error) {
          if (error.killed) {
            reject(
              new Error(
                `xcrun ${label} timed out after ${Math.round(timeoutMs / 1000)}s`
              )
            )
            return
          }
          reject(new Error(`xcrun failed: ${(err || out || error.message).trim()}`))
          return
        }
        resolve({ stdout: out, stderr: err })
      })
    })
  }
}

export async function submitAndWaitNotary({
  artifactPath,
  auth,
  run,
  log = console.log,
  statFn = statSync,
} = {}) {
  if (typeof run !== 'function') {
    throw new Error('submitAndWaitNotary requires a run() implementation')
  }

  let sizeLabel = 'unknown size'
  try {
    sizeLabel = formatArtifactSize(statFn(artifactPath).size)
  } catch {
    // Size is diagnostic only.
  }

  log(`[macos-signing] notary: uploading ${artifactPath} (${sizeLabel})`)
  const submitted = await run(notarytoolSubmitOnlyArgs(artifactPath, auth), {
    timeoutMs: NOTARY_UPLOAD_EXEC_TIMEOUT_MS,
    label: 'notarytool submit',
  })
  const submissionId = parseNotarySubmissionId(combinedOutput(submitted))
  if (!submissionId) {
    throw new Error('notarytool submit did not return a submission id')
  }

  log(
    `[macos-signing] notary: submitted ${submissionId} ` +
      `(waiting up to ${NOTARY_WAIT_TIMEOUT_SEC}s for Apple)`
  )

  try {
    const finished = await run(notarytoolWaitArgs(submissionId, auth), {
      timeoutMs: NOTARY_WAIT_EXEC_TIMEOUT_MS,
      label: 'notarytool wait',
    })
    const status = parseNotaryStatus(combinedOutput(finished)) || 'Accepted'
    if (status !== 'Accepted') {
      throw new Error(`notary submission ${submissionId} finished with status ${status}`)
    }
    log(`[macos-signing] notary: ${submissionId} Accepted`)
    return { submissionId, status }
  } catch (error) {
    let status = parseNotaryStatus(error?.message || '')
    try {
      const info = await run(notarytoolInfoArgs(submissionId, auth), {
        timeoutMs: NOTARY_INFO_EXEC_TIMEOUT_MS,
        label: 'notarytool info',
      })
      status = parseNotaryStatus(combinedOutput(info)) || status
    } catch {
      // Keep the original wait error; info is diagnostic.
    }
    log(formatNotaryFailureAdvice(submissionId, status))
    throw new Error(
      `${error?.message || 'notary wait failed'} (submission ${submissionId}` +
        `${status ? `, status ${status}` : ''})`
    )
  }
}
