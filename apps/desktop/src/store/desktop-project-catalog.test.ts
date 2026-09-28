import { beforeEach, describe, expect, it } from 'vitest'

import type { ProjectInfo } from '@/types/work4you'

import { forgetDesktopProject, mergeWithDesktopCatalog, rememberDesktopProjects } from './desktop-project-catalog'

function project(id: string, name = id): ProjectInfo {
  return {
    archived: false,
    board_slug: null,
    color: null,
    created_at: 1,
    description: null,
    folders: [],
    icon: null,
    id,
    name,
    primary_path: null,
    slug: id
  }
}

describe('desktop project catalog', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('keeps a project the current gateway did not return', () => {
    rememberDesktopProjects([project('local', 'Local')])

    const merged = mergeWithDesktopCatalog([project('cloud', 'Cloud')])

    expect(merged.map(row => row.id)).toEqual(['cloud', 'local'])
  })

  it('drops a project after it is deleted', () => {
    rememberDesktopProjects([project('local'), project('other')])
    forgetDesktopProject('local')

    expect(mergeWithDesktopCatalog([]).map(row => row.id)).toEqual(['other'])
  })
})
