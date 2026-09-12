import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ProfileInfo } from '@/types/work4you'

import { CreateProfileDialog, DEFAULT_CREATE_CLONE_FROM } from './create-profile-dialog'

vi.mock('@/work4you', () => ({
  createProfile: vi.fn(async () => ({ name: 'leo', ok: true, path: '/x' })),
  updateProfileSoul: vi.fn(async () => ({ ok: true }))
}))

afterEach(cleanup)

const defaultProfile = {
  has_env: true,
  is_default: true,
  model: null,
  name: 'default',
  path: '/home/user/.work4you',
  provider: null,
  skill_count: 3
} as ProfileInfo

describe('CreateProfileDialog', () => {
  it('defaults clone-from to blank (Fresh), not the default profile', () => {
    expect(DEFAULT_CREATE_CLONE_FROM).toBeNull()

    render(<CreateProfileDialog onClose={() => undefined} open profiles={[defaultProfile]} />)

    expect(screen.getByRole('combobox').textContent).toContain('None (blank)')
    expect(screen.getByText(/independent Work4You environments/)).toBeTruthy()
  })
})
