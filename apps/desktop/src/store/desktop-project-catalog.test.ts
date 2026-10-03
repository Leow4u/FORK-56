import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { $activeGatewayProfile } from '@/store/profile-identity'
import type { ProjectInfo } from '@/types/work4you'

import {
  desktopProjectCatalogKey,
  forgetDesktopProject,
  mergeWithDesktopCatalog,
  rememberDesktopProjects
} from './desktop-project-catalog'

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
    $activeGatewayProfile.set('default')
  })

  afterEach(() => {
    $activeGatewayProfile.set('default')
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

  it('keeps one catalog per profile', () => {
    rememberDesktopProjects([project('p_a', 'A')], 'default')
    rememberDesktopProjects([project('p_b', 'B')], 'coder')

    expect(mergeWithDesktopCatalog([], 'default').map(row => row.id)).toEqual(['p_a'])
    expect(mergeWithDesktopCatalog([], 'coder').map(row => row.id)).toEqual(['p_b'])
    // A profile that never saved anything starts empty, whatever the others hold.
    expect(mergeWithDesktopCatalog([], 'fresh')).toEqual([])
    expect(desktopProjectCatalogKey('fresh')).not.toBe(desktopProjectCatalogKey('default'))
  })

  it('follows the active gateway profile when none is given', () => {
    $activeGatewayProfile.set('coder')
    rememberDesktopProjects([project('p_b', 'B')])

    $activeGatewayProfile.set('default')
    expect(mergeWithDesktopCatalog([])).toEqual([])
    expect(mergeWithDesktopCatalog([], 'coder').map(row => row.id)).toEqual(['p_b'])
  })

  it('drops the pre-scope catalog instead of leaking it into every profile', () => {
    localStorage.setItem('work4you.desktop-projects', JSON.stringify([project('old')]))

    expect(mergeWithDesktopCatalog([], 'default')).toEqual([])
    expect(mergeWithDesktopCatalog([], 'coder')).toEqual([])
    expect(localStorage.getItem('work4you.desktop-projects')).toBeNull()
  })
})
