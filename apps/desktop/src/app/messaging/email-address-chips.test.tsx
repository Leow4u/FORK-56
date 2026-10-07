// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { EmailAddressChipInput } from './email-address-chips'

afterEach(() => cleanup())

describe('EmailAddressChipInput', () => {
  it('adds chips on Enter and deduplicates', () => {
    const onChange = vi.fn()

    render(
      <EmailAddressChipInput
        formatInvalid={value => `bad:${value}`}
        label="Allowed"
        onChange={onChange}
        placeholder="Add…"
        removeLabel={address => `Remove ${address}`}
        value={[]}
      />
    )

    const input = screen.getByLabelText('Allowed')
    fireEvent.change(input, { target: { value: 'Ana@Example.com' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenLastCalledWith(['ana@example.com'])

    fireEvent.change(input, { target: { value: 'ana@example.com' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenLastCalledWith(['ana@example.com'])
  })

  it('parses comma-separated paste on blur', () => {
    const onChange = vi.fn()

    render(
      <EmailAddressChipInput
        formatInvalid={value => `bad:${value}`}
        label="Allowed"
        onChange={onChange}
        removeLabel={address => `Remove ${address}`}
        value={[]}
      />
    )

    const input = screen.getByLabelText('Allowed')
    fireEvent.change(input, { target: { value: 'a@x.com, b@y.com' } })
    fireEvent.blur(input)
    expect(onChange).toHaveBeenCalledWith(['a@x.com', 'b@y.com'])
  })
})
