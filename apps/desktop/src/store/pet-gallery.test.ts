import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { $petInfo, setPetInfo } from './pet'
import {
  $petGallery,
  adoptPet,
  DEFAULT_PET_SHELF_SLUGS,
  type GalleryPet,
  type GatewayRequest,
  loadPetGallery,
  rankedGalleryPets,
  resetPetGallery
} from './pet-gallery'

function localGallery() {
  return {
    enabled: true,
    active: 'boba',
    pets: [{ slug: 'boba', displayName: 'Boba', installed: true }]
  }
}

describe('pet gallery pet.info sync', () => {
  beforeEach(() => {
    resetPetGallery()
    setPetInfo({ enabled: false })
  })

  afterEach(() => {
    resetPetGallery()
    setPetInfo({ enabled: false })
    vi.restoreAllMocks()
  })

  it('uses pet.info.meta and keeps the cached spritesheet when the revision is current', async () => {
    setPetInfo({
      enabled: true,
      slug: 'boba',
      displayName: 'Old Boba',
      scale: 0.33,
      spritesheetBase64: 'large-sprite-payload',
      spritesheetRevision: '100:2048',
      frameW: 192,
      frameH: 208
    })

    const requestMock = vi.fn(async (method: string) => {
      if (method === 'pet.gallery') {
        return localGallery()
      }

      if (method === 'pet.info.meta') {
        return {
          enabled: true,
          slug: 'boba',
          displayName: 'Boba',
          scale: 0.5,
          spritesheetRevision: '100:2048'
        }
      }

      if (method === 'pet.info') {
        throw new Error('full pet.info should not be called for an unchanged sprite')
      }

      throw new Error(`unexpected method: ${method}`)
    })

    const request = requestMock as unknown as GatewayRequest

    await loadPetGallery(request)

    const methods = requestMock.mock.calls.map(([method]) => method)
    expect(methods).toContain('pet.info.meta')
    expect(methods).not.toContain('pet.info')
    expect($petInfo.get()).toMatchObject({
      enabled: true,
      slug: 'boba',
      displayName: 'Boba',
      scale: 0.5,
      spritesheetBase64: 'large-sprite-payload',
      spritesheetRevision: '100:2048',
      frameW: 192,
      frameH: 208
    })
  })

  it('fetches full pet.info when metadata reports a new spritesheet revision', async () => {
    setPetInfo({
      enabled: true,
      slug: 'boba',
      displayName: 'Boba',
      scale: 0.33,
      spritesheetBase64: 'old-sprite-payload',
      spritesheetRevision: '100:2048'
    })

    const requestMock = vi.fn(async (method: string) => {
      if (method === 'pet.gallery') {
        return localGallery()
      }

      if (method === 'pet.info.meta') {
        return {
          enabled: true,
          slug: 'boba',
          displayName: 'Boba',
          scale: 0.33,
          spritesheetRevision: '101:4096'
        }
      }

      if (method === 'pet.info') {
        return {
          enabled: true,
          slug: 'boba',
          displayName: 'Boba',
          scale: 0.33,
          spritesheetBase64: 'new-sprite-payload',
          spritesheetRevision: '101:4096'
        }
      }

      throw new Error(`unexpected method: ${method}`)
    })

    const request = requestMock as unknown as GatewayRequest

    await loadPetGallery(request)

    const methods = requestMock.mock.calls.map(([method]) => method)
    expect(methods).toContain('pet.info.meta')
    expect(methods).toContain('pet.info')
    expect($petInfo.get().spritesheetBase64).toBe('new-sprite-payload')
    expect($petInfo.get().spritesheetRevision).toBe('101:4096')
  })

  it('falls back to full pet.info when an older gateway lacks metadata', async () => {
    const requestMock = vi.fn(async (method: string) => {
      if (method === 'pet.gallery') {
        return localGallery()
      }

      if (method === 'pet.info.meta') {
        throw new Error('JSON-RPC -32601: Method not found')
      }

      if (method === 'pet.info') {
        return {
          enabled: true,
          slug: 'boba',
          displayName: 'Boba from legacy gateway',
          scale: 0.4,
          spritesheetBase64: 'legacy-full-payload',
          spritesheetRevision: '99:1024'
        }
      }

      throw new Error(`unexpected method: ${method}`)
    })

    const request = requestMock as unknown as GatewayRequest

    await loadPetGallery(request)

    const methods = requestMock.mock.calls.map(([method]) => method)
    expect(methods).toContain('pet.info.meta')
    expect(methods).toContain('pet.info')
    expect($petInfo.get()).toMatchObject({
      enabled: true,
      slug: 'boba',
      displayName: 'Boba from legacy gateway',
      spritesheetBase64: 'legacy-full-payload',
      spritesheetRevision: '99:1024'
    })
  })

  it('keeps mutation sync on metadata when the selected pet sprite is unchanged', async () => {
    $petGallery.set(localGallery())
    setPetInfo({
      enabled: true,
      slug: 'boba',
      displayName: 'Boba',
      scale: 0.33,
      spritesheetBase64: 'large-sprite-payload',
      spritesheetRevision: '100:2048'
    })

    const requestMock = vi.fn(async (method: string) => {
      if (method === 'pet.select') {
        return { ok: true, slug: 'boba', displayName: 'Boba' }
      }

      if (method === 'pet.info.meta') {
        return {
          enabled: true,
          slug: 'boba',
          displayName: 'Boba',
          scale: 0.33,
          spritesheetRevision: '100:2048'
        }
      }

      if (method === 'pet.info') {
        throw new Error('full pet.info should not be called after an unchanged select')
      }

      throw new Error(`unexpected method: ${method}`)
    })

    const request = requestMock as unknown as GatewayRequest

    await expect(adoptPet(request, 'boba', 'Could not adopt pet.')).resolves.toBe(true)

    const methods = requestMock.mock.calls.map(([method]) => method)
    expect(methods).toEqual(['pet.select', 'pet.info.meta'])
    expect($petInfo.get().spritesheetBase64).toBe('large-sprite-payload')
  })

  it('drops the petdex catalog when merging the remote gallery', async () => {
    const requestMock = vi.fn(async (method: string, params?: Record<string, unknown>) => {
      if (method === 'pet.gallery') {
        if (params?.localOnly) {
          return {
            enabled: true,
            active: 'my-otter',
            pets: [{ slug: 'my-otter', displayName: 'My Otter', generated: true, installed: true }]
          }
        }

        return {
          enabled: true,
          active: 'my-otter',
          pets: [
            { slug: 'dalek', displayName: 'Dalek', installed: false },
            { slug: 'my-otter', displayName: 'My Otter', generated: true, installed: true },
            { slug: 'fufu', displayName: 'FuFu', installed: false },
            { slug: 'clawd', displayName: 'Clawd', curated: true, installed: false }
          ]
        }
      }

      if (method === 'pet.info.meta') {
        return { enabled: true, slug: 'my-otter', displayName: 'My Otter', scale: 0.33 }
      }

      throw new Error(`unexpected method: ${method}`)
    })

    await loadPetGallery(requestMock as unknown as GatewayRequest)

    const slugs = ($petGallery.get()?.pets ?? []).map(pet => pet.slug)
    expect(slugs).toContain('my-otter')
    expect(slugs).toContain('fufu')
    expect(slugs).not.toContain('dalek')
    expect(slugs).not.toContain('clawd')
    expect(rankedGalleryPets($petGallery.get(), 'dale')).toEqual([])
  })
})

describe('rankedGalleryPets', () => {
  const shelf = DEFAULT_PET_SHELF_SLUGS.map(slug => ({
    displayName: slug,
    installed: slug === 'fufu',
    slug
  })) satisfies GalleryPet[]

  const pets: GalleryPet[] = [
    { slug: 'dalek', displayName: 'Dalek', installed: false },
    { slug: 'nukey', displayName: 'Nukey', installed: false, curated: true },
    { slug: 'homelander', displayName: 'Homelander', installed: false },
    { slug: 'my-otter', displayName: 'My Otter', generated: true, installed: true },
    { slug: 'clawd-test', displayName: 'Clawd', curated: true, installed: false },
    ...shelf
  ]

  const gallery = { active: 'my-otter', enabled: true, pets }

  it('puts generated pets on the shelf, then the ten defaults in listed order', () => {
    expect(rankedGalleryPets(gallery, '').map(pet => pet.slug)).toEqual(['my-otter', ...DEFAULT_PET_SHELF_SLUGS])
  })

  it('does not list catalog pets that are not ours', () => {
    const slugs = rankedGalleryPets(gallery, '').map(pet => pet.slug)

    expect(slugs).not.toContain('dalek')
    expect(slugs).not.toContain('homelander')
    expect(slugs).not.toContain('nukey')
  })

  it('filters the shelf only — catalog search cannot install a new pet', () => {
    expect(rankedGalleryPets(gallery, 'dale')).toEqual([])
    expect(rankedGalleryPets(gallery, 'home')).toEqual([])
    expect(rankedGalleryPets(gallery, 'otter').map(pet => pet.slug)).toEqual(['my-otter'])
    expect(rankedGalleryPets(gallery, 'fufu').map(pet => pet.slug)).toEqual(['fufu'])
  })

  it('never lists clawd placeholder pets', () => {
    expect(rankedGalleryPets(gallery, 'clawd')).toEqual([])
    expect(rankedGalleryPets(gallery, '').some(pet => pet.slug.startsWith('clawd'))).toBe(false)
  })
})
