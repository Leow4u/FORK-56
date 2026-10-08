import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'

import { PaneVisibleContext } from '@/components/pane-shell/pane-visibility'
import type { TodoItem } from '@/lib/todos'
import { $todosBySession, clearSessionTodos, setSessionTodos } from '@/store/todos'
import { stubMenuDomApis, stubResizeObserver } from '@/test/jsdom'

import { ComposerStatusStack } from './index'

const todos: TodoItem[] = [
  { id: '1', content: 'Compare the signed documents', status: 'completed' },
  { id: '2', content: 'Correct the inventory and document precedence', status: 'in_progress' },
  { id: '3', content: 'Verify the final report', status: 'pending' }
]

const chip = () => screen.getByRole('button', { name: /Tasks: Step/ })

const mount = (sessionId = 'session-1') => (
  <MemoryRouter>
    <ComposerStatusStack queue={null} sessionId={sessionId} />
  </MemoryRouter>
)

describe('composer task progress', () => {
  beforeAll(() => {
    stubResizeObserver()
    stubMenuDomApis()
  })

  afterEach(() => {
    cleanup()
    clearSessionTodos('session-1')
    clearSessionTodos('session-2')
    $todosBySession.set({})
  })

  it('starts with the current step and activity, without rendering the full list', () => {
    setSessionTodos('session-1', todos)
    render(mount())
    expect(chip().textContent).toContain('Step 2 of 3')
    expect(chip().textContent).toContain(todos[1].content)
    expect(within(chip()).getByRole('status')).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByText(todos[0].content)).toBeNull()
  })

  it('previews on hover and lets the pointer cross the gap into the card', async () => {
    setSessionTodos('session-1', todos)
    render(mount())
    fireEvent.pointerEnter(chip())
    const card = await screen.findByRole('dialog', { name: 'Tasks' })
    expect(within(card).getAllByRole('listitem')).toHaveLength(3)
    fireEvent.pointerLeave(chip())
    fireEvent.pointerEnter(card)
    await new Promise(resolve => setTimeout(resolve, 220))
    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.pointerLeave(card)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('pins on click, stays open outside, then restores the chip and focus when minimized', async () => {
    setSessionTodos('session-1', todos)
    render(
      <>
        {mount()}
        <input aria-label="Composer" />
      </>
    )
    const trigger = chip()
    fireEvent.click(trigger)
    const card = await screen.findByRole('dialog')
    expect(trigger.classList.contains('invisible')).toBe(true)
    fireEvent.pointerLeave(card)
    fireEvent.pointerDown(screen.getByRole('textbox'))
    act(() => screen.getByRole('textbox').focus())
    await new Promise(resolve => setTimeout(resolve, 220))
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByRole('textbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Minimize' }))
    await waitFor(() => expect(document.activeElement).toBe(trigger))
    expect(trigger.classList.contains('invisible')).toBe(false)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens on keyboard focus and Escape only dismisses the task card', async () => {
    setSessionTodos('session-1', todos)
    render(mount())
    act(() => chip().focus())
    expect(await screen.findByRole('dialog')).toBeTruthy()
    fireEvent.keyDown(chip(), { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(chip()).toBe(document.activeElement)
  })

  it('updates the active task without losing the pinned state', async () => {
    setSessionTodos('session-1', todos)
    render(mount())
    fireEvent.click(chip())
    act(() =>
      setSessionTodos(
        'session-1',
        todos.map(todo => ({ ...todo, status: todo.id === '3' ? 'in_progress' : 'completed' }))
      )
    )
    const card = await screen.findByRole('dialog')
    expect(within(card).getByText('Step 3 of 3')).toBeTruthy()
    expect(within(card).getByText('2 of 3 completed')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Minimize' })).toBeTruthy()
  })

  it('does not carry a pinned card into another session', async () => {
    setSessionTodos('session-1', todos)
    setSessionTodos('session-2', [{ id: 'other', content: 'Another session task', status: 'in_progress' }])
    const view = render(mount())
    fireEvent.click(chip())
    expect(await screen.findByRole('dialog')).toBeTruthy()
    view.rerender(mount('session-2'))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(chip().textContent).toContain('Another session task')
  })

  it('hides a pinned portal with its kept-alive pane and restores it', async () => {
    setSessionTodos('session-1', todos)
    const view = render(<PaneVisibleContext value={true}>{mount()}</PaneVisibleContext>)
    fireEvent.click(chip())
    expect(await screen.findByRole('dialog')).toBeTruthy()
    view.rerender(<PaneVisibleContext value={false}>{mount()}</PaneVisibleContext>)
    expect(screen.queryByRole('dialog')).toBeNull()
    view.rerender(<PaneVisibleContext value={true}>{mount()}</PaneVisibleContext>)
    expect(await screen.findByRole('dialog')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Minimize' })).toBeTruthy()
  })

  it('uses pending tasks without a running spinner and excludes cancelled items from progress', async () => {
    setSessionTodos('session-1', [todos[0], { ...todos[1], status: 'cancelled' }, todos[2]])
    render(mount())
    expect(chip().textContent).toContain('Step 2 of 2')
    expect(chip().textContent).toContain(todos[2].content)
    expect(within(chip()).queryByRole('status')).toBeNull()
    fireEvent.click(chip())
    const card = await screen.findByRole('dialog')
    expect(within(card).getByText('1 of 2 completed')).toBeTruthy()
    expect(within(card).getByText('Cancelled')).toBeTruthy()
  })

  it('removes an open card when the session task list is cleared', async () => {
    setSessionTodos('session-1', todos)
    render(mount())
    fireEvent.click(chip())
    expect(await screen.findByRole('dialog')).toBeTruthy()
    act(() => clearSessionTodos('session-1'))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('button', { name: /Tasks:/ })).toBeNull()
  })

  it('labels an entirely cancelled plan without showing a misleading 0/0', () => {
    setSessionTodos(
      'session-1',
      todos.map(todo => ({ ...todo, status: 'cancelled' }))
    )
    render(mount())
    expect(screen.getByRole('button', { name: 'Tasks: Cancelled' })).toBeTruthy()
  })

  it('shows a completed summary without an activity spinner', () => {
    setSessionTodos(
      'session-1',
      todos.map(todo => ({ ...todo, status: 'completed' }))
    )
    render(mount())
    const trigger = screen.getByRole('button', { name: 'Tasks: 3 of 3 completed' })
    expect(within(trigger).queryByRole('status')).toBeNull()
  })
})
