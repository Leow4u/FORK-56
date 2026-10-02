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

const { setProfileColor } = vi.hoisted(() => ({ setProfileColor: vi.fn() }))

vi.mock('@/store/profile', () => ({ setProfileColor }))

afterEach(() => {
  cleanup()
  vi.mocked(createProfile).mockClear()
  vi.mocked(updateProfileSoul).mockClear()
  setProfileColor.mockClear()
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

  it('keeps the chosen color locally and honours the switch-after-create choice', async () => {
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
    const swatch = screen.getAllByRole('button', { name: /^Set color/ })[0]
    fireEvent.click(swatch)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Switch to it after creating' }))

    await submit()

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('cores', { switchTo: false }))
    expect(setProfileColor).toHaveBeenCalledWith('cores', expect.any(String))
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
