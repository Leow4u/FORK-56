import type { PanelSection } from '../types.js'

export const SETUP_REQUIRED_TITLE = 'Setup Required'
export const SETUP_REQUIRED_STATUS = 'setup required'
export const FIRST_RUN_PORTAL_ARGS = ['setup', '--portal'] as const

export function isFirstRunSetupRequired(status: string | undefined): boolean {
  return status === SETUP_REQUIRED_STATUS
}

/** First-run launches Portal only. After setup, `/setup <section>` stays intact. */
export function firstRunSetupLaunchArgs(status: string | undefined, extra: string[] = []): string[] {
  if (isFirstRunSetupRequired(status)) {
    return [...FIRST_RUN_PORTAL_ARGS]
  }

  return ['setup', ...extra]
}

export const buildSetupRequiredSections = (): PanelSection[] => [
  {
    text: 'Work4You needs a Work4You Portal account before the TUI can start a session.'
  },
  {
    rows: [
      ['/setup', 'sign in with Work4You Portal'],
      ['Ctrl+C', 'exit and run `work4you setup --portal` manually']
    ],
    title: 'Actions'
  }
]
