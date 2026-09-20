import { describe, expect, it } from 'vitest'

import { orderProjectsByIds, overviewRepoPaths, sortProjectsForOverview } from './model'
import { NO_PROJECT_ID, type SidebarProjectTree } from './workspace-groups'

function makeProject(id: string, sessionCount: number): SidebarProjectTree {
  return {
    id,
    isAuto: true,
    label: id,
    lastActive: 0,
    path: `/repos/${id}`,
    previewSessions: [],
    repos: [],
    sessionCount
  }
}

const home = (): SidebarProjectTree => ({
  ...makeProject(NO_PROJECT_ID, 2),
  isAuto: false,
  isNoProject: true,
  path: null
})

const ids = (projects: SidebarProjectTree[]) => projects.map(project => project.id)

describe('orderProjectsByIds', () => {
  it('leaves the deterministic sort alone when nothing has been dragged', () => {
    const projects = [makeProject('a', 0), makeProject('b', 2)]

    expect(orderProjectsByIds(projects, [])).toBe(projects)
  })

  it('applies the saved manual order', () => {
    const projects = [makeProject('a', 1), makeProject('b', 1), makeProject('c', 1)]

    expect(ids(orderProjectsByIds(projects, ['c', 'a', 'b']))).toEqual(['c', 'a', 'b'])
  })

  it('keeps freshly-scanned zero-session repos below the hand-ordered list', () => {
    // The regression: a disk scan keeps finding git checkouts the user has
    // never opened in Work4You. Surfacing every unsaved id at the top buried the
    // projects they deliberately dragged into place.
    const projects = [makeProject('scanned-1', 0), makeProject('mine', 4), makeProject('scanned-2', 0)]

    expect(ids(orderProjectsByIds(projects, ['mine']))).toEqual(['mine', 'scanned-1', 'scanned-2'])
  })

  it('still surfaces a new project that has real activity', () => {
    // A project you just started working in should not sink beneath the saved
    // order — only the zero-session discoveries do.
    const projects = [makeProject('ordered', 1), makeProject('just-started', 3)]

    expect(ids(orderProjectsByIds(projects, ['ordered']))).toEqual(['just-started', 'ordered'])
  })

  it('drops ids that are no longer present', () => {
    const projects = [makeProject('a', 1)]

    expect(ids(orderProjectsByIds(projects, ['gone', 'a']))).toEqual(['a'])
  })

  it('keeps Home below a hand-picked folder order', () => {
    const projects = [makeProject('a', 1), home(), makeProject('b', 1)]

    expect(ids(orderProjectsByIds(projects, ['b', 'a']))).toEqual(['b', 'a', NO_PROJECT_ID])
  })
})

describe('sortProjectsForOverview', () => {
  it('puts Home below the active project', () => {
    const active = { ...makeProject('active', 5), isAuto: false }
    const projects = [makeProject('scanned', 0), active, home()]

    expect(ids(sortProjectsForOverview(projects, 'active'))).toEqual(['active', 'scanned', NO_PROJECT_ID])
  })
})

describe('overviewRepoPaths', () => {
  it('collects unique repo roots and skips Home', () => {
    const homeProject = home()
    homeProject.repos = [{ groups: [], id: 'none', label: 'Home', path: null, sessionCount: 1 }]

    const website: SidebarProjectTree = {
      ...makeProject('website', 2),
      repos: [
        { groups: [], id: '/repos/website', label: 'website', path: '/repos/website', sessionCount: 2 },
        { groups: [], id: '/repos/docs', label: 'docs', path: '/repos/docs', sessionCount: 0 }
      ]
    }

    const duplicateRoot: SidebarProjectTree = {
      ...makeProject('also-website', 1),
      repos: [{ groups: [], id: '/repos/website', label: 'website', path: '/repos/website', sessionCount: 1 }]
    }

    expect(overviewRepoPaths([homeProject, website, duplicateRoot])).toEqual(['/repos/website', '/repos/docs'])
  })

  it('returns an empty list when every project is Home or pathless', () => {
    expect(overviewRepoPaths([home(), { ...makeProject('empty', 0), path: null, repos: [] }])).toEqual([])
  })
})
