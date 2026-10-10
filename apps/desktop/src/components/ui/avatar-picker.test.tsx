// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { atom } from 'nanostores'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type * as AvatarImage from '@/lib/avatar-image'
import { defaultShapeFor } from '@/lib/bot-avatar'
import { BOT_CHARACTERS } from '@/lib/bot-characters'
import type * as PetGalleryStore from '@/store/pet-gallery'
import type { PetGallery, PetGalleryStatus } from '@/store/pet-gallery'

// The New profile avatar picker: the four ways the WorkBots editor gives a
// bot a face, wired to the same gateway calls.
const gateway = vi.hoisted(() => ({ request: vi.fn() }))

const imageLib = vi.hoisted(() => ({
  normalizeAvatarImage: vi.fn(async (dataUrl: string) => dataUrl),
  pickAvatarFile: vi.fn(async (): Promise<File | null> => null),
  readAvatarFile: vi.fn(async (): Promise<null | string> => null)
}))

const pets = vi.hoisted(() => {
  const { atom: makeAtom } = require('nanostores') as { atom: typeof atom }

  return {
    $petGallery: makeAtom<null | PetGallery>(null),
    $petGalleryStatus: makeAtom<PetGalleryStatus>('idle'),
    loadPetGallery: vi.fn(async () => undefined),
    loadPetThumb: vi.fn(async (_request: unknown, slug: string) =>
      slug === 'broken' ? null : `data:image/png;base64,${slug}`
    )
  }
})

vi.mock('@/app/gateway/hooks/use-gateway-request', () => ({
  useGatewayRequest: () => ({ requestGateway: gateway.request })
}))
vi.mock('@/lib/avatar-image', async importOriginal => ({
  ...(await importOriginal<typeof AvatarImage>()),
  normalizeAvatarImage: imageLib.normalizeAvatarImage,
  pickAvatarFile: imageLib.pickAvatarFile,
  readAvatarFile: imageLib.readAvatarFile
}))
vi.mock('@/store/pet-gallery', async importOriginal => ({
  ...(await importOriginal<typeof PetGalleryStore>()),
  $petGallery: pets.$petGallery,
  $petGalleryStatus: pets.$petGalleryStatus,
  loadPetGallery: pets.loadPetGallery,
  loadPetThumb: pets.loadPetThumb
}))
vi.mock('@/lib/bot-face-clock', () => ({ startFaceClock: vi.fn() }))

// PetThumb watches its box with an IntersectionObserver jsdom doesn't ship.
vi.stubGlobal(
  'IntersectionObserver',
  class {
    disconnect() {}
    observe() {}
    unobserve() {}
  }
)

const { AvatarPicker } = await import('./avatar-picker')

function Harness(props: Partial<Parameters<typeof AvatarPicker>[0]> = {}) {
  return (
    <AvatarPicker
      color={null}
      image={null}
      name="research"
      onColor={() => undefined}
      onImage={() => undefined}
      onShape={() => undefined}
      shape={null}
      {...props}
    />
  )
}

beforeEach(() => {
  gateway.request.mockReset()
  imageLib.pickAvatarFile.mockReset()
  imageLib.readAvatarFile.mockReset()
  pets.$petGallery.set(null)
  pets.$petGalleryStatus.set('idle')
  pets.loadPetGallery.mockClear()
  pets.loadPetThumb.mockClear()
})

afterEach(cleanup)

describe('AvatarPicker · Bot', () => {
  it('draws every shape as the profile’s face and highlights what the name rolls', () => {
    render(<Harness />)

    const rolled = defaultShapeFor('research')
    const tile = screen.getByRole('button', { name: `Shape ${rolled}` })

    expect(tile.getAttribute('aria-pressed')).toBe('true')
    expect(tile.querySelector('svg')?.getAttribute('data-bot-face')).toBe('research')
    expect(screen.getByRole('button', { name: 'Characters' })).toBeTruthy()
  })

  it('picking a shape drops any picture; picking a color reports it', () => {
    const onShape = vi.fn()
    const onImage = vi.fn()
    const onColor = vi.fn()

    render(<Harness image="data:image/png;base64,old" onColor={onColor} onImage={onImage} onShape={onShape} />)

    fireEvent.click(screen.getByRole('button', { name: 'Shape cloud' }))
    expect(onShape).toHaveBeenCalledWith('cloud')
    expect(onImage).toHaveBeenCalledWith(null)

    fireEvent.click(screen.getByRole('button', { name: 'Set color #ef4444' }))
    expect(onColor).toHaveBeenCalledWith('#ef4444')

    fireEvent.click(screen.getByRole('button', { name: 'Remove image — use shape' }))
    expect(onImage).toHaveBeenCalledTimes(2)
  })

  it('picks a ready-made character, clears a previous image and preserves the selection after reopening', () => {
    const onShape = vi.fn()
    const onImage = vi.fn()
    const onColor = vi.fn()
    const character = BOT_CHARACTERS[0]

    const { rerender } = render(
      <Harness image="data:image/png;base64,old" onColor={onColor} onImage={onImage} onShape={onShape} />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Characters' }))
    fireEvent.click(screen.getByRole('button', { name: 'Headphones' }))
    expect(onShape).toHaveBeenCalledWith(character.shape)
    expect(onColor).toHaveBeenCalledWith(character.color)
    expect(onImage).toHaveBeenCalledWith(null)

    rerender(<Harness name="renamed-profile" shape={character.shape} />)
    expect(screen.getByRole('button', { name: 'Headphones' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Headphones' }).querySelector('img')?.getAttribute('src')).toBe(
      character.image
    )

    fireEvent.click(screen.getByRole('button', { name: 'Classic shapes' }))
    expect(screen.getByRole('button', { name: 'Shape cloud' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('opens saved characters on their catalog and retains legacy blob appearances until a new choice', () => {
    const onShape = vi.fn()
    const { unmount } = render(<Harness onShape={onShape} shape={BOT_CHARACTERS[1].shape} />)

    expect(screen.getByRole('button', { name: 'Sunglasses' }).getAttribute('aria-pressed')).toBe('true')
    expect(onShape).not.toHaveBeenCalled()
    unmount()

    render(<Harness onShape={onShape} shape="blobatar::cloud" />)
    expect(screen.getByRole('button', { name: 'Headphones' }).getAttribute('aria-pressed')).toBe('false')
    expect(onShape).not.toHaveBeenCalled()
  })
})

describe('AvatarPicker · Generate', () => {
  it('asks the gateway for a square picture from the description and hands it over', async () => {
    const onImage = vi.fn()

    gateway.request.mockImplementation(async (method: string, params?: Record<string, unknown>) => {
      if (params?.probe) {
        return { available: true }
      }

      return { image_data: 'data:image/png;base64,drawn', success: true }
    })

    render(<Harness onImage={onImage} />)
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }))

    // The form appears once the probe answers; the tab and the action share a
    // name, and the action is the one after the textbox.
    fireEvent.change(await screen.findByRole('textbox', { name: 'Describe your avatar…' }), {
      target: { value: 'a tiny owl' }
    })

    const button = screen.getAllByRole('button', { name: 'Generate' }).at(-1) as HTMLElement

    await act(async () => {
      fireEvent.click(button)
    })

    await waitFor(() => expect(onImage).toHaveBeenCalledWith('data:image/png;base64,drawn'))
    expect(gateway.request).toHaveBeenLastCalledWith('image.generate', {
      aspect_ratio: 'square',
      prompt: expect.stringMatching(/^a tiny owl\./)
    })
  })

  it('says so when the gateway has no image backend', async () => {
    gateway.request.mockResolvedValue({ available: false })

    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }))

    expect(await screen.findByText(/No image model available/)).toBeTruthy()
  })
})

describe('AvatarPicker · Upload', () => {
  it('reads the picked file, normalizes it and hands it over; refuses an oversized one', async () => {
    const onImage = vi.fn()
    const file = new File(['x'], 'me.png', { type: 'image/png' })

    imageLib.pickAvatarFile.mockResolvedValue(file)
    imageLib.readAvatarFile.mockResolvedValueOnce('data:image/png;base64,me').mockResolvedValueOnce(null)

    render(<Harness onImage={onImage} />)
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose an image…' }))
    })
    await waitFor(() => expect(onImage).toHaveBeenCalledWith('data:image/png;base64,me'))
    expect(imageLib.normalizeAvatarImage).toHaveBeenCalledWith('data:image/png;base64,me')

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose an image…' }))
    })
    expect(await screen.findByText('Image too large (max 15MB).')).toBeTruthy()
    expect(onImage).toHaveBeenCalledTimes(1)
  })
})

describe('AvatarPicker · Pet', () => {
  it('loads the gallery once and hands the picked pet’s idle frame over', async () => {
    const onImage = vi.fn()

    pets.$petGallery.set({
      active: '',
      enabled: false,
      pets: [
        { displayName: 'Claude Crab', installed: true, slug: 'claude-crab', spritesheetUrl: 'https://x/crab.webp' },
        { displayName: 'Broken', installed: true, slug: 'broken' }
      ]
    })
    pets.$petGalleryStatus.set('ready')

    render(<Harness onImage={onImage} />)
    fireEvent.click(screen.getByRole('button', { name: 'Pet' }))

    expect(pets.loadPetGallery).toHaveBeenCalledTimes(1)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Claude Crab/ }))
    })
    await waitFor(() => expect(onImage).toHaveBeenCalledWith('data:image/png;base64,claude-crab'))
    expect(pets.loadPetThumb).toHaveBeenCalledWith(gateway.request, 'claude-crab', 'https://x/crab.webp')

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Broken/ }))
    })
    expect(await screen.findByText('Could not load that pet — try another.')).toBeTruthy()
    expect(onImage).toHaveBeenCalledTimes(1)
  })

  it('tells an empty gallery apart from one still loading', async () => {
    pets.$petGalleryStatus.set('loading')

    const { rerender } = render(<Harness />)

    fireEvent.click(screen.getByRole('button', { name: 'Pet' }))
    expect(screen.queryByText(/No pets in the gallery/)).toBeNull()

    pets.$petGallery.set({ active: '', enabled: false, pets: [] })
    pets.$petGalleryStatus.set('ready')
    rerender(<Harness />)

    expect(await screen.findByText(/No pets in the gallery/)).toBeTruthy()
  })
})
