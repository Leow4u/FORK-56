import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ProfileInfo } from '@/types/work4you'
import { createProfile, updateProfileSoul } from '@/work4you'

import { CreateProfileDialog, DEFAULT_CREATE_CLONE_FROM, PERSONA_TEMPLATES } from './create-profile-dialog'

vi.mock('@/work4you', () => ({
  createProfile: vi.fn(async () => ({ name: 'leo', ok: true, path: '/x' })),
  updateProfileSoul: vi.fn(async () => ({ ok: true }))
}))

// Radix Checkbox measures itself with a ResizeObserver jsdom doesn't ship.
vi.stubGlobal(
  'ResizeObserver',
  class {
    disconnect() {}
    observe() {}
    unobserve() {}
  }
)

const { saveProfileLook } = vi.hoisted(() => ({ saveProfileLook: vi.fn(async () => undefined) }))

vi.mock('@/store/profile', () => ({ saveProfileLook }))
vi.mock('@/lib/bot-face-clock', () => ({ startFaceClock: vi.fn() }))

// The picker has its own test; here it is three buttons that hand a pick to
// the dialog, so the test reads what the dialog saves.
vi.mock('./avatar-picker', () => ({
  AvatarPicker: ({
    onColor,
    onImage,
    onShape
  }: {
    onColor: (color: null | string) => void
    onImage: (image: null | string) => void
    onShape: (shape: string) => void
  }) => (
    <div data-slot="avatar-picker">
      <button onClick={() => onShape('cloud')} type="button">
        pick shape
      </button>
      <button onClick={() => onColor('#ef4444')} type="button">
        pick color
      </button>
      <button onClick={() => onImage('data:image/png;base64,me')} type="button">
        pick image
      </button>
    </div>
  )
}))

afterEach(() => {
  cleanup()
  vi.mocked(createProfile).mockClear()
  vi.mocked(updateProfileSoul).mockClear()
  saveProfileLook.mockClear()
})

const defaultProfile = {
  has_env: true,
  is_default: true,
  model: null,
  name: 'default',
  path: '/home/user/.work4you',
  provider: null,
  skill_count: 3
} as ProfileInfo

function typeName(value: string) {
  fireEvent.change(screen.getByLabelText('Name'), { target: { value } })
}

async function submit() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Create profile' }))
  })
}

describe('CreateProfileDialog', () => {
  it('starts blank (Fresh): no clone source until the user asks to copy', () => {
    expect(DEFAULT_CREATE_CLONE_FROM).toBeNull()

    render(<CreateProfileDialog onClose={() => undefined} open profiles={[defaultProfile]} />)

    expect(screen.getByText(/independent Work4You environments/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Fresh' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.queryByRole('combobox')).toBeNull()

    const soul = screen.getByRole('textbox', { name: /Persona/ })
    expect(soul.tagName).toBe('TEXTAREA')
    expect(soul.getAttribute('id')).toBe('new-profile-soul')
  })

  it('creates a fresh profile with bundled skills by default and reports no switch for Manage', async () => {
    const onCreated = vi.fn()
    render(<CreateProfileDialog onClose={() => undefined} onCreated={onCreated} open profiles={[defaultProfile]} />)

    typeName('suporte')
    await submit()

    await waitFor(() => expect(createProfile).toHaveBeenCalledTimes(1))
    expect(vi.mocked(createProfile).mock.calls[0][0]).toEqual({
      name: 'suporte',
      clone_from: null,
      clone_all: false,
      no_skills: false
    })
    expect(updateProfileSoul).not.toHaveBeenCalled()
    expect(onCreated).toHaveBeenCalledWith('suporte', { switchTo: false })
  })

  it('writes the chosen persona template as SOUL.md', async () => {
    render(<CreateProfileDialog onClose={() => undefined} open profiles={[defaultProfile]} />)

    typeName('pesquisa')
    fireEvent.click(screen.getByRole('button', { name: 'Research' }))
    expect((screen.getByRole('textbox', { name: /Persona/ }) as HTMLTextAreaElement).value).toBe(
      PERSONA_TEMPLATES.research
    )

    await submit()

    await waitFor(() => expect(updateProfileSoul).toHaveBeenCalledWith('pesquisa', PERSONA_TEMPLATES.research))
  })

  it('copies from the default profile once asked to copy, full copy on request', async () => {
    render(<CreateProfileDialog onClose={() => undefined} open profiles={[defaultProfile]} />)

    typeName('clone')
    fireEvent.click(screen.getByRole('button', { name: 'Copy from' }))

    // Copy mode preselects the default profile so the common case is one click.
    expect(screen.getByRole('combobox', { name: 'Copy from' }).textContent).toContain('default')
    fireEvent.click(screen.getByRole('button', { name: 'Everything (full copy)' }))

    await submit()

    await waitFor(() => expect(createProfile).toHaveBeenCalledTimes(1))
    expect(vi.mocked(createProfile).mock.calls[0][0]).toEqual({
      name: 'clone',
      clone_from: 'default',
      clone_all: true,
      no_skills: false
    })
  })

  it('saves the picked look on the new profile and honours the switch-after-create choice', async () => {
    const onCreated = vi.fn()
    render(
      <CreateProfileDialog
        onClose={() => undefined}
        onCreated={onCreated}
        open
        profiles={[defaultProfile]}
        showSwitchOption
      />
    )

    typeName('cores')
    fireEvent.click(screen.getByRole('button', { name: 'pick shape' }))
    fireEvent.click(screen.getByRole('button', { name: 'pick color' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Switch to it after creating' }))

    await submit()

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('cores', { switchTo: false }))
    expect(saveProfileLook).toHaveBeenCalledWith('cores', { color: '#ef4444', image: null, shape: 'cloud' })
    // The look lands after the profile exists, before the caller is told.
    expect(vi.mocked(createProfile).mock.invocationCallOrder[0]).toBeLessThan(
      saveProfileLook.mock.invocationCallOrder[0]
    )
    expect(saveProfileLook.mock.invocationCallOrder[0]).toBeLessThan(onCreated.mock.invocationCallOrder[0])
  })

  it('leaves the look to the name when nothing was picked, and saves a picked picture', async () => {
    render(<CreateProfileDialog onClose={() => undefined} open profiles={[defaultProfile]} />)

    typeName('semcor')
    await submit()
    await waitFor(() => expect(createProfile).toHaveBeenCalledTimes(1))
    expect(saveProfileLook).not.toHaveBeenCalled()

    cleanup()
    render(<CreateProfileDialog onClose={() => undefined} open profiles={[defaultProfile]} />)
    typeName('foto')
    fireEvent.click(screen.getByRole('button', { name: 'pick image' }))
    await submit()

    await waitFor(() =>
      expect(saveProfileLook).toHaveBeenCalledWith('foto', {
        color: null,
        image: 'data:image/png;base64,me',
        shape: null
      })
    )
  })

  it('previews the bot the profile will be, following the typed name', () => {
    render(<CreateProfileDialog onClose={() => undefined} open profiles={[defaultProfile]} />)

    const preview = () => document.querySelector('[data-slot="profile-preview"] svg')

    expect(preview()?.getAttribute('data-bot-face')).toBe('agent')

    typeName('pesquisa')
    expect(preview()?.getAttribute('data-bot-face')).toBe('pesquisa')

    fireEvent.click(screen.getByRole('button', { name: 'pick shape' }))
    expect(preview()?.getAttribute('data-hb-shape')).toBe('cloud')

    fireEvent.click(screen.getByRole('button', { name: 'pick image' }))
    expect(document.querySelector('[data-slot="profile-preview"] img')?.getAttribute('src')).toBe(
      'data:image/png;base64,me'
    )
  })

  it('turns bundled skills off for a blank profile when asked', async () => {
    render(<CreateProfileDialog onClose={() => undefined} open profiles={[defaultProfile]} />)

    typeName('vazio')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Install bundled skills' }))
    await submit()

    await waitFor(() => expect(createProfile).toHaveBeenCalledTimes(1))
    expect(vi.mocked(createProfile).mock.calls[0][0]).toMatchObject({ no_skills: true })
  })
})
