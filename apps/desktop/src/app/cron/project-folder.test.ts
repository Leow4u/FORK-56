import { describe, expect, it } from 'vitest'

import { NO_PROJECT_ID } from '@/app/chat/sidebar/projects/workspace-groups'
import { ALL_PROJECTS } from '@/store/project-scope'

import { cronProjectFolder } from './project-folder'

const projects = [
  { id: 'demo', path: '/Users/ada/Demo' },
  { id: NO_PROJECT_ID, path: null }
]

describe('cronProjectFolder', () => {
  it('runs a new local job in the scoped project folder', () => {
    expect(cronProjectFolder('demo', projects, false)).toBe('/Users/ada/Demo')
  })

  it('has no folder for all projects, Home, or an unknown scope', () => {
    expect(cronProjectFolder(ALL_PROJECTS, projects, false)).toBeNull()
    expect(cronProjectFolder(NO_PROJECT_ID, projects, false)).toBeNull()
    expect(cronProjectFolder('gone', projects, false)).toBeNull()
    expect(cronProjectFolder(null, projects, false)).toBeNull()
  })

  it('never sends this computer folder to a remote backend', () => {
    expect(cronProjectFolder('demo', projects, true)).toBeNull()
  })
})
