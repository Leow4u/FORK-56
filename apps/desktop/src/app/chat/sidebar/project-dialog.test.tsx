import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type * as Nanostores from 'nanostores'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { closeProjectDialog, createProject, goToProject } from '@/store/projects'

import { ProjectDialog } from './project-dialog'

afterEach(() => {
  cleanup()
  vi.mocked(createProject).mockClear()
  vi.mocked(goToProject).mockClear()
  vi.mocked(closeProjectDialog).mockClear()
})

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: {
      common: { cancel: 'Cancel', save: 'Save' },
      sidebar: {
        projects: {
          addFolder: 'Add folder',
          create: 'Create',
          createDesc: 'Create a new project',
          createFailed: 'Failed to create project',
          createTitle: 'New project',
          foldersLabel: 'Folders',
          ideaGenerate: 'Generate',
          ideaGenerating: 'Generating…',
          ideaLabel: 'Idea',
          ideaPlaceholder: 'What are you building?',
          ideaShuffle: 'Shuffle ideas',
          namePlaceholder: 'Project name',
          noFolders: 'No folders yet',
          primaryBadge: 'Primary',
          removeFolder: 'Remove folder'
        }
      }
    }
  })
}))

// $projectDialog is a real nanostore atom in the app; recreate it here so
// useStore behaves identically without pulling in the rest of the projects
// store (backend calls, project list, etc.) which is irrelevant to the Tip fix.
// vi.mock factories are hoisted above the rest of the file, so the atom must
// be created inside vi.hoisted to exist by the time the factory runs.
const { $projectDialog } = vi.hoisted(() => {
  const { atom } = require('nanostores') as typeof Nanostores

  return {
    $projectDialog: atom<{ mode: 'create' | 'rename' | 'add-folder'; name?: string; projectId?: string } | null>({
      mode: 'create'
    })
  }
})

vi.mock('@/store/projects', () => ({
  $projectDialog,
  addProjectFolder: vi.fn(),
  closeProjectDialog: vi.fn(),
  createProject: vi.fn(async () => ({
    id: 'p_cars',
    name: 'Carros Eduardo',
    primary_path: '/Users/test/my-folder'
  })),
  generateProjectIdea: vi.fn(),
  goToProject: vi.fn(),
  pickProjectFolder: vi.fn(async () => '/Users/test/my-folder'),
  renameProject: vi.fn()
}))

vi.mock('@/store/notifications', () => ({
  notifyError: vi.fn()
}))

vi.mock('@/lib/project-idea-templates', () => ({
  randomIdeaTemplates: () => [{ emoji: '🚀', idea: 'A rocket tracker', label: 'Rocket tracker' }]
}))

const tipTrigger = (el: HTMLElement) => el.closest('[data-slot="tooltip-trigger"]')

describe('ProjectDialog', () => {
  it('keeps the create fields and empty-folder copy', () => {
    render(<ProjectDialog />)

    expect(screen.getByPlaceholderText('Project name')).toBeTruthy()
    expect(screen.getByText('Folders')).toBeTruthy()
    expect(screen.getByText('No folders yet')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add folder' })).toBeTruthy()
    expect(screen.getByText('Idea')).toBeTruthy()
    expect(screen.getByPlaceholderText('What are you building?')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Create' })).toBeTruthy()
  })

  it('wraps the "shuffle idea" button in a Tip', () => {
    render(<ProjectDialog />)

    const button = screen.getByRole('button', { name: 'Shuffle ideas' })
    expect(tipTrigger(button)).toBeTruthy()
  })

  it('wraps the "remove folder" button in a Tip once a folder is added', async () => {
    render(<ProjectDialog />)

    fireEvent.click(screen.getByRole('button', { name: 'Add folder' }))

    const button = await screen.findByRole('button', { name: 'Remove folder' })
    expect(tipTrigger(button)).toBeTruthy()
  })

  it('enters the created project and anchors a new session', async () => {
    render(<ProjectDialog />)

    fireEvent.change(screen.getByPlaceholderText('Project name'), { target: { value: 'Carros Eduardo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add folder' }))
    await screen.findByRole('button', { name: 'Remove folder' })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => {
      expect(createProject).toHaveBeenCalledWith(
        expect.objectContaining({ folders: ['/Users/test/my-folder'], name: 'Carros Eduardo', use: true })
      )
      expect(goToProject).toHaveBeenCalledWith('p_cars', { newSession: true })
    })
  })
})
