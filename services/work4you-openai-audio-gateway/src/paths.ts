/**
 * Paths the Work4You STT/TTS tools actually call via the OpenAI SDK:
 *   client.audio.transcriptions.create → POST /v1/audio/transcriptions
 *   client.audio.speech.create            → POST /v1/audio/speech
 * Translations uses the same audio surface. Chat, images, files, and
 * realtime stay closed so the platform OpenAI key cannot leak into inference.
 */
const ALLOWED = new Set([
  'POST /v1/audio/transcriptions',
  'POST /v1/audio/translations',
  'POST /v1/audio/speech',
])

export function normalizePath(pathname: string): string {
  if (!pathname.startsWith('/')) return `/${pathname}`
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1)
  }
  return pathname
}

export function isAllowedOpenAIAudioRoute(
  method: string,
  pathname: string,
): boolean {
  const m = method.toUpperCase()
  const p = normalizePath(pathname)
  if (p.includes('..') || p.includes('//')) return false
  return ALLOWED.has(`${m} ${p}`)
}

export function routePurpose(pathname: string): string {
  const p = normalizePath(pathname)
  if (p.endsWith('/speech')) return 'openai-audio:speech'
  if (p.endsWith('/translations')) return 'openai-audio:translations'
  return 'openai-audio:transcriptions'
}
