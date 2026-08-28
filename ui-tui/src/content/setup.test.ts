import { describe, expect, it } from 'vitest'

import {
  buildSetupRequiredSections,
  FIRST_RUN_PORTAL_ARGS,
  firstRunSetupLaunchArgs,
  isFirstRunSetupRequired,
  SETUP_REQUIRED_STATUS
} from './setup.js'

describe('first-run Portal door', () => {
  it('treats setup-required status as first-run', () => {
    expect(isFirstRunSetupRequired(SETUP_REQUIRED_STATUS)).toBe(true)
    expect(isFirstRunSetupRequired('ready')).toBe(false)
    expect(isFirstRunSetupRequired(undefined)).toBe(false)
  })

  it('launches setup --portal on first-run and ignores lab/section args', () => {
    expect(firstRunSetupLaunchArgs(SETUP_REQUIRED_STATUS)).toEqual([...FIRST_RUN_PORTAL_ARGS])
    expect(firstRunSetupLaunchArgs(SETUP_REQUIRED_STATUS, ['model'])).toEqual([...FIRST_RUN_PORTAL_ARGS])
    expect(firstRunSetupLaunchArgs(SETUP_REQUIRED_STATUS, ['--quick'])).toEqual([...FIRST_RUN_PORTAL_ARGS])
  })

  it('keeps the post-setup wizard and section args intact', () => {
    expect(firstRunSetupLaunchArgs('ready')).toEqual(['setup'])
    expect(firstRunSetupLaunchArgs('ready', ['model'])).toEqual(['setup', 'model'])
    expect(firstRunSetupLaunchArgs('ready', ['gateway'])).toEqual(['setup', 'gateway'])
    expect(firstRunSetupLaunchArgs(undefined, ['tools'])).toEqual(['setup', 'tools'])
  })

  it('does not advertise /model or lab/key setup on the first-run panel', () => {
    const sections = buildSetupRequiredSections()
    const rows = sections.flatMap(section => section.rows ?? [])
    const actions = rows.map(row => row[0])

    expect(actions).toEqual(['/setup', 'Ctrl+C'])
    expect(JSON.stringify(sections)).not.toMatch(/\/model|api key|blank slate|full setup|choose later/i)
    expect(JSON.stringify(sections)).toMatch(/Work4You Portal/)
  })
})
