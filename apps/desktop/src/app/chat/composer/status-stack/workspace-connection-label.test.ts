import { describe, expect, it } from 'vitest'

import { workspaceConnectionLabel } from './workspace-connection-label'

describe('workspaceConnectionLabel', () => {
  it('stays off the strip with a single connection', () => {
    expect(workspaceConnectionLabel(0, 'This device')).toBeNull()
    expect(workspaceConnectionLabel(1, 'This device')).toBeNull()
  })

  it('paints the active source when more than one connection exists', () => {
    expect(workspaceConnectionLabel(2, 'This device')).toBe('This device')
    expect(workspaceConnectionLabel(2, 'Work4You Cloud')).toBe('Work4You Cloud')
  })

  it('skips a blank label even with multiple connections', () => {
    expect(workspaceConnectionLabel(2, '')).toBeNull()
    expect(workspaceConnectionLabel(2, '   ')).toBeNull()
    expect(workspaceConnectionLabel(2, null)).toBeNull()
  })
})
