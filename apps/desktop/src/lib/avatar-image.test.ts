import { describe, expect, it, vi } from 'vitest'

import {
  AVATAR_IMAGE_MAX_BYTES,
  avatarPrompt,
  type AvatarRequest,
  generateAvatarImage,
  normalizeAvatarImage,
  probeImageGeneration,
  readAvatarFile
} from './avatar-image'

// The image side of a profile's avatar: the prompt the gateway draws from,
// the generate / probe calls, and the device picture guard.

/** A gateway that answers every call with `result` (or throws it). */
function gatewayAnswering(result: unknown, { throws = false } = {}) {
  const request = vi.fn(async () => {
    if (throws) {
      throw result
    }

    return result
  })

  return request as unknown as AvatarRequest & typeof request
}

describe('avatarPrompt', () => {
  it('names the profile when nothing is described, and lets a description win', () => {
    expect(avatarPrompt({ name: 'research' })).toContain('named "research"')
    expect(avatarPrompt({ name: 'research', title: 'Scout' })).toContain('named "Scout"')
    expect(avatarPrompt({ describe: '  a purple octopus ', name: 'research' })).toMatch(
      /^a purple octopus\. Avatar for an AI agent/
    )
    expect(avatarPrompt({ name: '  ' })).toContain('named "agent"')
  })
})

describe('generateAvatarImage', () => {
  it('asks for a square picture and returns the inlined data first', async () => {
    const request = gatewayAnswering({
      image: 'https://cdn/x.png',
      image_data: 'data:image/png;base64,x',
      success: true
    })

    await expect(generateAvatarImage(request, { name: 'research' })).resolves.toBe('data:image/png;base64,x')
    expect(request).toHaveBeenCalledWith('image.generate', {
      aspect_ratio: 'square',
      prompt: avatarPrompt({ name: 'research' })
    })
  })

  it('falls back to the backend URL and throws with the backend message', async () => {
    await expect(
      generateAvatarImage(gatewayAnswering({ image: 'https://cdn/x.png', success: true }), { name: 'a' })
    ).resolves.toBe('https://cdn/x.png')
    await expect(
      generateAvatarImage(gatewayAnswering({ error: 'no backend', success: false }), { name: 'a' })
    ).rejects.toThrow('no backend')
    await expect(generateAvatarImage(gatewayAnswering(null), { name: 'a' })).rejects.toThrow('generation failed')
  })
})

describe('probeImageGeneration', () => {
  it('reports the backend answer and never throws', async () => {
    await expect(probeImageGeneration(gatewayAnswering({ available: true }))).resolves.toBe(true)
    await expect(probeImageGeneration(gatewayAnswering({ available: false }))).resolves.toBe(false)
    await expect(probeImageGeneration(gatewayAnswering(new Error('Method not found'), { throws: true }))).resolves.toBe(
      false
    )
  })
})

describe('readAvatarFile', () => {
  it('reads a picture as a data URL and refuses one over the cap', async () => {
    const small = new Blob(['png-bytes'], { type: 'image/png' })

    await expect(readAvatarFile(small)).resolves.toMatch(/^data:image\/png;base64,/)

    const big = { size: AVATAR_IMAGE_MAX_BYTES + 1 } as Blob

    await expect(readAvatarFile(big)).resolves.toBeNull()
  })
})

describe('normalizeAvatarImage', () => {
  it('hands the picture back unchanged when decoding stalls', async () => {
    vi.useFakeTimers()

    try {
      const pending = normalizeAvatarImage('data:image/png;base64,raw', 256, 50)

      vi.advanceTimersByTime(60)

      await expect(pending).resolves.toBe('data:image/png;base64,raw')
    } finally {
      vi.useRealTimers()
    }
  })
})
