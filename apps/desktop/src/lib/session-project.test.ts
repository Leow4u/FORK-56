import { describe, expect, it } from 'vitest'

import { membershipProjectId } from './session-project'

const projects = [
  { id: 'p_dute', archived: false },
  { id: 'p_old', archived: true }
]

describe('membershipProjectId', () => {
  it('keeps a chat in the project it was born in when the cwd is a cloud path', () => {
    expect(membershipProjectId({ desktop_project_id: 'p_dute' }, projects)).toBe('p_dute')
  })

  it('ignores an archived or unknown project id', () => {
    expect(membershipProjectId({ desktop_project_id: 'p_old' }, projects)).toBeNull()
    expect(membershipProjectId({ desktop_project_id: 'p_missing' }, projects)).toBeNull()
  })

  it('leaves unclaimed chats for the path rules', () => {
    expect(membershipProjectId({}, projects)).toBeNull()
    expect(membershipProjectId({ desktop_project_id: '  ' }, projects)).toBeNull()
  })
})
