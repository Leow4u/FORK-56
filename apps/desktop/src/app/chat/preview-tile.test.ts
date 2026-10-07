import { describe, expect, it } from 'vitest'

import { group, split } from '@/components/pane-shell/tree/model'

import { interactedChat } from './preview-tile'

const tree = split('row', [
  group(['workspace', 'session-tile:stacked'], { active: 'workspace', id: 'main' }),
  group(['session-tile:side'], { active: 'session-tile:side', id: 'tile' }),
  group(['preview-tile:file:file:///work/a.html', 'review'], { active: 'review', id: 'area' })
])

describe('interactedChat — the conversation the content area follows', () => {
  it('names the primary chat when the user works in it', () => {
    expect(interactedChat(tree, 'main', 'selected', 'selected')).toBeNull()
  })

  it('names the session tile the user works in', () => {
    expect(interactedChat(tree, 'tile', 'side', 'selected')).toBe('side')
  })

  it('names a session tile stacked into the primary zone when it is in front', () => {
    const stacked = split('row', [
      group(['workspace', 'session-tile:stacked'], { active: 'session-tile:stacked', id: 'main' })
    ])

    expect(interactedChat(stacked, 'main', 'stacked', 'selected')).toBe('stacked')
  })

  // Clicking the content area, a tool or the sidebar is not working in a
  // different conversation: the area keeps the one it follows.
  it('names no chat for anything that is not a chat', () => {
    expect(interactedChat(tree, 'area', 'selected', 'selected')).toBeUndefined()
    expect(interactedChat(tree, null, 'selected', 'selected')).toBeUndefined()
    expect(interactedChat(null, 'main', 'selected', 'selected')).toBeUndefined()
  })
})
