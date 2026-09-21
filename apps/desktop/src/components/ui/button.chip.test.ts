import { describe, expect, it } from 'vitest'

import { cn } from '@/lib/utils'

import { buttonVariants } from './button'

describe('button chip variant', () => {
  it('paints a labeled chip as a pill bubble', () => {
    const classes = cn(buttonVariants({ size: 'sm', variant: 'chip' }))

    expect(classes).toContain('rounded-full')
    expect(classes).toContain('bg-(--ui-chat-bubble-background)')
    expect(classes).toContain('shadow-[inset_0_0_0_1px_var(--ui-stroke-tertiary)]')
  })

  it('keeps icon chips circular over the icon-size radius', () => {
    const classes = cn(buttonVariants({ size: 'icon-sm', variant: 'chip' }))

    expect(classes).toContain('rounded-full')
    expect(classes).not.toMatch(/rounded-\[4px\]/)
  })
})
