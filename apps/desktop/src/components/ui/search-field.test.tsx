import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { I18nProvider } from '@/i18n'

import { SearchField } from './search-field'

afterEach(cleanup)

function renderField(recede?: boolean) {
  return render(
    <I18nProvider configClient={null} initialLocale="en">
      <SearchField onChange={() => undefined} placeholder="Search MCP servers..." recede={recede} value="" />
    </I18nProvider>
  )
}

describe('SearchField recede', () => {
  it('fades an empty sidebar field and keeps page fields readable', () => {
    const quiet = renderField()
    expect(quiet.getByRole('textbox').parentElement?.className).toContain('opacity-30')
    quiet.unmount()

    const page = renderField(false)
    expect(page.getByRole('textbox').parentElement?.className).not.toContain('opacity-30')
  })
})
