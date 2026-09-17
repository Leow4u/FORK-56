/**
 * Shared notarytool flags for afterSign (local) and the CI DMG step.
 *
 * Release Desktop run 35249919145 signed Work4You.app with Developer ID, then
 * afterSign spawned `notarytool --wait` with no timeout. Apple never returned;
 * the 90-minute job killed pid 38554 (notarytool). CI must notarize the DMG
 * in its own step, not block electron-builder.
 */

export const NOTARY_WAIT_TIMEOUT_SEC = 1200
export const NOTARY_EXEC_TIMEOUT_MS = (NOTARY_WAIT_TIMEOUT_SEC + 60) * 1000

export function shouldSkipAfterSignNotarize(env = process.env) {
  return String(env.WORK4YOU_SKIP_AFTERSIGN_NOTARIZE || '').trim() === '1'
}

export function notarytoolSubmitArgs(
  artifactPath,
  { keyPath, keyId, issuer, timeoutSec = NOTARY_WAIT_TIMEOUT_SEC } = {}
) {
  return [
    'notarytool',
    'submit',
    artifactPath,
    '--key',
    keyPath,
    '--key-id',
    keyId,
    '--issuer',
    issuer,
    '--wait',
    '--timeout',
    String(timeoutSec),
  ]
}

export function notarytoolProfileSubmitArgs(
  artifactPath,
  profile,
  timeoutSec = NOTARY_WAIT_TIMEOUT_SEC
) {
  return [
    'notarytool',
    'submit',
    artifactPath,
    '--keychain-profile',
    profile,
    '--wait',
    '--timeout',
    String(timeoutSec),
  ]
}
