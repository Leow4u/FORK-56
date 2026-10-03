import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type * as Nanostores from 'nanostores'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { en } from '@/i18n/en'
import { closeProjectDialog, createProject, goToProject, pickProjectFolder } from '@/store/projects'

import { ProjectDialog, splitFolderPath } from './project-dialog'

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
          makePrimary: 'Make primary',
          nameLabel: 'Name',
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

const tipTrigger = (el: HTMLElement) => el.closest('[data-slot="tooltip-trigger"]')

describe('ProjectDialog', () => {
  it('labels the name field the same way as the other sections', () => {
    render(<ProjectDialog />)

    expect(screen.getByText('Name')).toBeTruthy()
    expect(screen.getByText('No folders yet')).toBeTruthy()
  })

  it('offers no ready-made idea templates', () => {
    render(<ProjectDialog />)

    expect(screen.queryByRole('button', { name: /shuffle/i })).toBeNull()
    expect(screen.getByPlaceholderText('What are you building?')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Generate' })).toBeTruthy()
  })

  it('drops the sample name and the IDEA.md note from the create copy', () => {
    expect(en.sidebar.projects.namePlaceholder.toLowerCase()).not.toContain('skunkworks')
    expect(en.sidebar.projects.namePlaceholder.trim().length).toBeGreaterThan(0)
    expect(en.sidebar.projects.ideaPlaceholder).not.toContain('IDEA.md')
  })

  it('shows the folder name and keeps a long path from widening the dialog', async () => {
    const folder = 'C:\\Users\\leona\\OneDrive - Dutel\\Pasta Profissional\\Empresas\\DUTELOG\\Recursos Humanos'
    expect(splitFolderPath(folder)).toEqual({
      name: 'Recursos Humanos',
      parent: 'C:\\Users\\leona\\OneDrive - Dutel\\Pasta Profissional\\Empresas\\DUTELOG'
    })

    vi.mocked(pickProjectFolder).mockResolvedValueOnce(folder)
    render(<ProjectDialog />)
    fireEvent.click(screen.getByRole('button', { name: 'Add folder' }))

    expect(await screen.findByText('Recursos Humanos')).toBeTruthy()
    const dialog = document.querySelector('[data-slot="dialog-content"]')
    expect(dialog?.className).toContain('overflow-x-hidden')
    expect(dialog?.className).toContain('min-w-0')
    expect(screen.getByText('Recursos Humanos').closest('li')?.className).toContain('overflow-hidden')
    // The path stays in the tooltip; the row shows the folder name alone.
    expect(screen.queryByText(/OneDrive - Dutel/)).toBeNull()
  })

  it('shows the parent folder only when two folders share a name', async () => {
    vi.mocked(pickProjectFolder)
      .mockResolvedValueOnce('/Users/test/clients/acme/web')
      .mockResolvedValueOnce('/Users/test/clients/globex/web')
    render(<ProjectDialog />)

    fireEvent.click(screen.getByRole('button', { name: 'Add folder' }))
    await screen.findByText('web')
    expect(screen.queryByText('/Users/test/clients/acme')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Add folder' }))
    await screen.findByText('/Users/test/clients/globex')
    expect(screen.getByText('/Users/test/clients/acme')).toBeTruthy()
    expect(screen.getAllByText('web')).toHaveLength(2)
  })

  it('lets a later folder become the primary and sends it on create', async () => {
    vi.mocked(pickProjectFolder)
      .mockResolvedValueOnce('/Users/test/dute-app')
      .mockResolvedValueOnce('/Users/test/dute-api')
    render(<ProjectDialog />)

    fireEvent.change(screen.getByPlaceholderText('Project name'), { target: { value: 'Dute' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add folder' }))
    await screen.findByText('dute-app')
    fireEvent.click(screen.getByRole('button', { name: 'Add folder' }))
    await screen.findByText('dute-api')

    // First folder is primary by default: it carries the badge, the other
    // offers the switch.
    expect(screen.getAllByText('Primary')).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: 'Make primary' })).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'Make primary' }))
    expect(screen.getByText('dute-api').closest('li')?.textContent).toContain('Primary')
    expect(screen.getByText('dute-app').closest('li')?.textContent).toContain('Make primary')

    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => {
      expect(createProject).toHaveBeenCalledWith(
        expect.objectContaining({
          folders: ['/Users/test/dute-app', '/Users/test/dute-api'],
          primaryPath: '/Users/test/dute-api'
        })
      )
    })
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
