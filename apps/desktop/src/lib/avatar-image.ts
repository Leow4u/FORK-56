// Image avatars for a profile: a picture from the device, one the gateway's
// image backend draws, or a pet's idle frame. Pure helpers shared by the
// create-profile avatar picker; nothing here touches React or a store.

/** Same cap the WorkBots editor applies to an uploaded picture. */
export const AVATAR_IMAGE_MAX_BYTES = 15_000_000

/** Edge of the square the picture is normalized to before it is stored. */
export const AVATAR_IMAGE_EDGE = 256

export const AVATAR_IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif'

/** The one gateway call shape these helpers need. */
export type AvatarRequest = <T>(method: string, params?: Record<string, unknown>) => Promise<T>

/** Center-crop and downscale a picture to a small square PNG so the profile
 *  asset stays light. Resolves to the input when the picture cannot be
 *  decoded, when the environment has no canvas, or when decoding stalls. */
export function normalizeAvatarImage(dataUrl: string, edge = AVATAR_IMAGE_EDGE, stallMs = 8000): Promise<string> {
  if (typeof Image === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(dataUrl)
  }

  return new Promise(resolve => {
    let settled = false

    const done = (value: string) => {
      if (!settled) {
        settled = true
        window.clearTimeout(stall)
        resolve(value)
      }
    }

    const stall = window.setTimeout(() => done(dataUrl), stallMs)
    const img = new Image()

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')

        canvas.width = edge
        canvas.height = edge

        const ctx = canvas.getContext('2d')

        if (!ctx) {
          done(dataUrl)

          return
        }

        const side = Math.min(img.width, img.height)

        ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, edge, edge)
        done(canvas.toDataURL('image/png'))
      } catch {
        done(dataUrl)
      }
    }

    img.onerror = () => done(dataUrl)
    img.src = dataUrl
  })
}

/** Read a picked file as a data URL. Null when the file is too large or
 *  unreadable, so callers can show one message and keep the dialog open. */
export function readAvatarFile(file: Blob, maxBytes = AVATAR_IMAGE_MAX_BYTES): Promise<null | string> {
  if (file.size > maxBytes) {
    return Promise.resolve(null)
  }

  return new Promise(resolve => {
    const reader = new FileReader()

    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(file)
  })
}

/** Open the device's file picker for one image. Resolves to null when the
 *  person cancels. */
export function pickAvatarFile(accept = AVATAR_IMAGE_ACCEPT): Promise<File | null> {
  return new Promise(resolve => {
    const input = document.createElement('input')

    input.type = 'file'
    input.accept = accept
    input.onchange = () => resolve(input.files?.[0] ?? null)
    input.oncancel = () => resolve(null)
    input.click()
  })
}

export interface AvatarPromptSeed {
  /** What the person typed on the Generate tab; wins when present. */
  describe?: string
  name: string
  title?: string
}

/** The prompt the WorkBots editor uses, so a face generated from the New
 *  profile dialog looks like one generated from Edit Profile. */
export function avatarPrompt({ describe, name, title }: AvatarPromptSeed): string {
  const custom = (describe ?? '').trim()

  if (custom) {
    return `${custom}. Avatar for an AI agent: centered, bold flat vector style, solid color background, no text.`
  }

  const who = (title ?? '').trim() || name.trim() || 'agent'

  return (
    `Cute minimal robot avatar for an AI agent named "${who}". ` +
    'Friendly simple mascot face, bold flat vector style, solid color background, centered, no text.'
  )
}

interface GenerateResponse {
  error?: string
  image?: string
  image_data?: string
  success?: boolean
}

/** Draw an avatar with the gateway's image backend. Resolves to a data URL
 *  (or the backend's own URL when the gateway could not inline it); throws
 *  with the backend's message when generation fails. */
export async function generateAvatarImage(request: AvatarRequest, seed: AvatarPromptSeed): Promise<string> {
  const res = await request<GenerateResponse | null>('image.generate', {
    aspect_ratio: 'square',
    prompt: avatarPrompt(seed)
  })

  if (!res?.success) {
    throw new Error(res?.error || 'generation failed')
  }

  const image = res.image_data || res.image

  if (!image) {
    throw new Error('generation returned no image')
  }

  return image
}

/** Does the gateway have an image backend? False on any failure (older
 *  gateway without the RPC, socket down), never a throw. */
export async function probeImageGeneration(request: AvatarRequest): Promise<boolean> {
  try {
    const res = await request<{ available?: boolean } | null>('image.generate', { probe: true })

    return Boolean(res?.available)
  } catch {
    return false
  }
}
