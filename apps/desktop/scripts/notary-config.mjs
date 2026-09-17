/**
 * Shared notarytool flags for afterSign (local) and the CI DMG step.
 *
 * Release Desktop run 35249919145 signed Work4You.app with Developer ID, then
 * afterSign spawned `notarytool --wait` with no timeout. Apple never returned;
 * the job killed pid 38554 (notarytool). CI must notarize the DMG in its own
 * step, not block electron-builder.
 *
 * Run 35261884765 then used `notarytool submit --wait --timeout 1200`. Upload
 * succeeded (id 3b7b6623-b2c4-4f6b-8ee6-ed71db5b7c42) but Apple was still
 * In Progress when the 20-minute timeout fired. Combined submit+wait burns
 * the budget on upload. Submit first, log the id, then wait separately.
 */

export const NOTARY_UPLOAD_TIMEOUT_SEC = 1200
export const NOTARY_WAIT_TIMEOUT_SEC = 3600
export const NOTARY_INFO_TIMEOUT_SEC = 60
export const NOTARY_UPLOAD_EXEC_TIMEOUT_MS = (NOTARY_UPLOAD_TIMEOUT_SEC + 60) * 1000
export const NOTARY_WAIT_EXEC_TIMEOUT_MS = (NOTARY_WAIT_TIMEOUT_SEC + 90) * 1000
export const NOTARY_INFO_EXEC_TIMEOUT_MS = NOTARY_INFO_TIMEOUT_SEC * 1000

const SUBMISSION_ID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

export function shouldSkipAfterSignNotarize(env = process.env) {
  return String(env.WORK4YOU_SKIP_AFTERSIGN_NOTARIZE || '').trim() === '1'
}

export function notarytoolAuthArgs(auth = {}) {
  const profile = String(auth.profile || '').trim()
  if (profile) return ['--keychain-profile', profile]

  const keyPath = String(auth.keyPath || '').trim()
  const keyId = String(auth.keyId || '').trim()
  const issuer = String(auth.issuer || '').trim()
  if (!keyPath || !keyId || !issuer) {
    throw new Error('notary auth requires a keychain profile or key + key-id + issuer')
  }
  return ['--key', keyPath, '--key-id', keyId, '--issuer', issuer]
}

export function notarytoolSubmitOnlyArgs(artifactPath, auth) {
  return [
    'notarytool',
    'submit',
    artifactPath,
    ...notarytoolAuthArgs(auth),
    '--output-format',
    'json',
  ]
}

export function notarytoolWaitArgs(
  submissionId,
  auth,
  timeoutSec = NOTARY_WAIT_TIMEOUT_SEC
) {
  return [
    'notarytool',
    'wait',
    submissionId,
    ...notarytoolAuthArgs(auth),
    '--timeout',
    String(timeoutSec),
    '--output-format',
    'json',
  ]
}

export function notarytoolInfoArgs(submissionId, auth) {
  return [
    'notarytool',
    'info',
    submissionId,
    ...notarytoolAuthArgs(auth),
    '--output-format',
    'json',
  ]
}

export function parseJsonObject(text) {
  const raw = String(text || '').trim()
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    if (start === -1 || end <= start) return null
    try {
      const parsed = JSON.parse(raw.slice(start, end + 1))
      return parsed && typeof parsed === 'object' ? parsed : null
    } catch {
      return null
    }
  }
}

export function parseNotarySubmissionId(output) {
  const json = parseJsonObject(output)
  if (json && typeof json.id === 'string' && SUBMISSION_ID_RE.test(json.id)) {
    return json.id
  }
  const text = String(output || '')
  const labeled = text.match(/^\s*id:\s*([0-9a-f-]{36})\s*$/im)
  if (labeled && SUBMISSION_ID_RE.test(labeled[1])) return labeled[1]
  return ''
}

export function parseNotaryStatus(output) {
  const json = parseJsonObject(output)
  if (json && typeof json.status === 'string' && json.status.trim()) {
    return json.status.trim()
  }
  const labeled = String(output || '').match(/^\s*status:\s*(.+)$/im)
  return labeled ? labeled[1].trim() : ''
}

export function formatArtifactSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return 'unknown size'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatNotaryFailureAdvice(submissionId, status) {
  const state = status ? `status ${status}` : 'status unknown'
  const lines = [`[macos-signing] notary: submission ${submissionId} ${state}.`]
  if (!status || status === 'In Progress') {
    lines.push(
      `[macos-signing] notary: Apple is still processing. Check later with: xcrun notarytool info ${submissionId}`
    )
  } else {
    lines.push(
      `[macos-signing] notary: inspect the rejection with: xcrun notarytool log ${submissionId}`
    )
  }
  return lines.join('\n')
}
