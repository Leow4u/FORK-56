import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'

import { shouldSkipAfterSignNotarize } from './notary-config.mjs'
import { createXcrunRunner, submitAndWaitNotary } from './notary-run.mjs'

const LOCAL_TOOL_TIMEOUT_MS = 5 * 60 * 1000

function run(command, args) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: LOCAL_TOOL_TIMEOUT_MS }, (error, stdout, stderr) => {
      if (error) {
        if (error.killed) {
          reject(new Error(`${command} timed out after ${LOCAL_TOOL_TIMEOUT_MS / 1000}s`))
          return
        }
        reject(
          new Error(
            `${command} failed: ${stderr?.trim() || stdout?.trim() || error.message}`
          )
        )
        return
      }
      resolve({ stdout, stderr })
    })
  })
}

function inlineKeyLooksValid(value) {
  return value.includes('BEGIN PRIVATE KEY') && value.includes('END PRIVATE KEY')
}

function resolveApiKeyPath(rawValue) {
  const value = String(rawValue || '').trim()
  if (!value) return { keyPath: '', cleanup: () => {} }

  if (fs.existsSync(value)) {
    return { keyPath: value, cleanup: () => {} }
  }

  if (!inlineKeyLooksValid(value)) {
    throw new Error('APPLE_API_KEY must be a file path or inline .p8 key content')
  }

  const tempPath = path.join(os.tmpdir(), `work4you-notary-${Date.now()}-${process.pid}.p8`)
  fs.writeFileSync(tempPath, value, 'utf8')
  return {
    keyPath: tempPath,
    cleanup: () => {
      try {
        fs.rmSync(tempPath, { force: true })
      } catch {
        // Best-effort cleanup.
      }
    }
  }
}

async function notarizeZip(zipPath, auth) {
  const runXcrun = createXcrunRunner()
  await submitAndWaitNotary({ artifactPath: zipPath, auth, run: runXcrun })
}

export default async function notarize(context) {
  const { electronPlatformName, appOutDir, packager } = context
  if (electronPlatformName !== 'darwin') return

  if (shouldSkipAfterSignNotarize(process.env)) {
    console.log(
      '[macos-signing] afterSign: skipping app notarize ' +
        '(WORK4YOU_SKIP_AFTERSIGN_NOTARIZE=1); the DMG step will notarize'
    )
    return
  }

  const appName = packager.appInfo.productFilename
  const appPath = path.join(appOutDir, `${appName}.app`)
  if (!fs.existsSync(appPath)) {
    throw new Error(`Cannot notarize missing app bundle: ${appPath}`)
  }

  const zipPath = path.join(appOutDir, `${appName}.zip`)
  const profile = String(process.env.APPLE_NOTARY_PROFILE || '').trim()
  const keyId = String(process.env.APPLE_API_KEY_ID || '').trim()
  const issuer = String(process.env.APPLE_API_ISSUER || '').trim()
  const rawApiKey = process.env.APPLE_API_KEY

  if (!profile && (!rawApiKey || !keyId || !issuer)) {
    console.log(
      'Skipping notarization: APPLE_API_KEY, APPLE_API_KEY_ID, and APPLE_API_ISSUER are not fully configured.'
    )
    return
  }

  const { keyPath, cleanup } = profile
    ? { keyPath: '', cleanup: () => {} }
    : resolveApiKeyPath(rawApiKey)
  const auth = profile ? { profile } : { keyPath, keyId, issuer }

  try {
    console.log('[macos-signing] afterSign: zipping app for notarytool')
    await run('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', appPath, zipPath])
    await notarizeZip(zipPath, auth)
    await run('xcrun', ['stapler', 'staple', '-v', appPath])
  } finally {
    try {
      fs.rmSync(zipPath, { force: true })
    } catch {
      // Best-effort cleanup.
    }
    cleanup()
  }
}
