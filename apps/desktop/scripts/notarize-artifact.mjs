import { existsSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFile } from 'node:child_process'

import {
  NOTARY_EXEC_TIMEOUT_MS,
  NOTARY_WAIT_TIMEOUT_SEC,
  notarytoolProfileSubmitArgs,
  notarytoolSubmitArgs,
} from './notary-config.mjs'

function run(command, args) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: NOTARY_EXEC_TIMEOUT_MS }, (error, stdout, stderr) => {
      if (error) {
        if (error.killed) {
          reject(new Error(`${command} timed out after ${NOTARY_WAIT_TIMEOUT_SEC}s`))
          return
        }
        // Intentionally omit args from the rejection message: callers pass
        // notarization credentials (key id, issuer, key file path) here, and
        // surfacing them in error output would land in CI logs.
        reject(new Error(`${command} failed: ${stderr?.trim() || stdout?.trim() || error.message}`))
        return
      }
      resolve()
    })
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

async function main() {
  const artifactPath = process.argv[2]
  if (!artifactPath || !existsSync(artifactPath)) {
    throw new Error(`Missing artifact to notarize: ${artifactPath || '(none)'}`)
  }

  const profile = String(process.env.APPLE_NOTARY_PROFILE || '').trim()
  if (profile) {
    console.log(
      `[macos-signing] notarize-artifact: submitting ${artifactPath} ` +
        `(wait timeout ${NOTARY_WAIT_TIMEOUT_SEC}s)`
    )
    await run('xcrun', notarytoolProfileSubmitArgs(artifactPath, profile))
    await run('xcrun', ['stapler', 'staple', '-v', artifactPath])
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
    console.log(
      `[macos-signing] notarize-artifact: submitting ${artifactPath} ` +
        `(wait timeout ${NOTARY_WAIT_TIMEOUT_SEC}s)`
    )
    await run('xcrun', notarytoolSubmitArgs(artifactPath, { keyPath, keyId, issuer }))
    await run('xcrun', ['stapler', 'staple', '-v', artifactPath])
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
