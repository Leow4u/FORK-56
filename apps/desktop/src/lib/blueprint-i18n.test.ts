import { describe, expect, it } from 'vitest'

import { blueprintCatalogPt } from '@/i18n/blueprint-catalog/pt'
import type { AutomationBlueprint } from '@/work4you'

import { localizeAutomationBlueprint } from './blueprint-i18n'

const morningBrief: AutomationBlueprint = {
  appUrl: '',
  category: 'daily',
  command: '',
  description: "A short daily briefing: today's calendar, weather, and anything urgent waiting on you.",
  fields: [
    {
      default: '08:00',
      help: '24h local time, e.g. 08:00',
      label: 'What time?',
      name: 'time',
      optional: false,
      options: [],
      type: 'time'
    }
  ],
  key: 'morning-brief',
  tags: [],
  title: 'Morning briefing'
}

describe('localizeAutomationBlueprint', () => {
  it('overlays Portuguese gallery copy while keeping blueprint keys', () => {
    const localized = localizeAutomationBlueprint(morningBrief, blueprintCatalogPt)

    expect(localized.key).toBe('morning-brief')
    expect(localized.title).toBe('Briefing matinal')
    expect(localized.description).toContain('agenda')
    expect(localized.fields[0]?.label).toBe('A que horas?')
  })

  it('leaves backend English when no catalog is configured', () => {
    expect(localizeAutomationBlueprint(morningBrief, undefined).title).toBe('Morning briefing')
  })
})
