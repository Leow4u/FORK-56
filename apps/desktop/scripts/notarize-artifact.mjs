import { existsSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFile } from 'node:child_process'

import { createXcrunRunner, submitAndWaitNotary } from './notary-run.mjs'

const STAPLE_TIMEOUT_MS = 5 * 60 * 1000

function runStaple(artifactPath) {
  return new Promise((resolve, reject) => {
    execFile(
      'xcrun',
      ['stapler', 'staple', '-v', artifactPath],
      { timeout: STAPLE_TIMEOUT_MS },
      (error, stdout, stderr) => {
        if (stdout?.trim()) console.log(stdout.trimEnd())
        if (stderr?.trim()) console.error(stderr.trimEnd())
        if (error) {
          if (error.killed) {
            reject(new Error(`xcrun stapler timed out after ${STAPLE_TIMEOUT_MS / 1000}s`))
            return
          }
          reject(new Error(`xcrun failed: ${stderr?.trim() || stdout?.trim() || error.message}`))
          return
        }
        resolve()
      }
    )
  })
}

function inlineKeyLooksValid(value) {
  return value.includes('BEGIN PRIVATE KEY') && value.includes('END PRIVATE KEY')
}

function resolveApiKeyPath(rawValue) {
  const value = String(rawValue || '').trim()
  if (!value) return { keyPath: '', cleanup: () => {} }

  if (existsSync(value)) {
    return { keyPath: value, cleanup: () => {} }
  }

  if (!inlineKeyLooksValid(value)) {
    throw new Error('APPLE_API_KEY must be a file path or inline .p8 key content')
  }

  const tempPath = join(tmpdir(), `work4you-notary-${Date.now()}-${process.pid}.p8`)
  writeFileSync(tempPath, value, 'utf8')
  return {
    keyPath: tempPath,
    cleanup: () => rmSync(tempPath, { force: true })
  }
}

async function notarizeWithAuth(artifactPath, auth) {
  const run = createXcrunRunner()
  await submitAndWaitNotary({ artifactPath, auth, run })
  await runStaple(artifactPath)
}

async function main() {
  const artifactPath = process.argv[2]
  if (!artifactPath || !existsSync(artifactPath)) {
    throw new Error(`Missing artifact to notarize: ${artifactPath || '(none)'}`)
  }

  const profile = String(process.env.APPLE_NOTARY_PROFILE || '').trim()
  if (profile) {
    await notarizeWithAuth(artifactPath, { profile })
    return
  }

  const keyId = String(process.env.APPLE_API_KEY_ID || '').trim()
  const issuer = String(process.env.APPLE_API_ISSUER || '').trim()
  const rawApiKey = process.env.APPLE_API_KEY
  if (!rawApiKey || !keyId || !issuer) {
    throw new Error('APPLE_API_KEY, APPLE_API_KEY_ID, and APPLE_API_ISSUER are required')
  }

  const { keyPath, cleanup } = resolveApiKeyPath(rawApiKey)
  try {
    await notarizeWithAuth(artifactPath, { keyPath, keyId, issuer })
  } finally {
    cleanup()
  }
}

main().catch((error) => {
  console.error('Notarization failed. Check configuration and command output in secure CI logs.')
  if (error?.message) {
    console.error(error.message)
  }
  process.exit(1)
})
