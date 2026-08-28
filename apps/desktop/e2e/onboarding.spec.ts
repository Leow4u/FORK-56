/**
 * E2E onboarding tests — verify the provider picker appears when no
 * inference provider is configured.
 *
 * Launches the app with an empty config.yaml (no providers). The renderer
 * should detect the unconfigured state and show the DesktopOnboardingOverlay
 * with the Work4You Portal account door.
 *
 * Prerequisite: `npm run build` must have been run so dist/ exists.
 */

import { expect, test } from './test'

import {
  type NoProviderFixture,
  setupNoProvider,
  waitForOnboarding,
} from './fixtures'
import { expectVisualSnapshot } from './visual-snapshot'

let fixture: NoProviderFixture | null = null

test.afterAll(async () => {
  await fixture?.cleanup()
  fixture = null
})

test.describe('onboarding with no provider configured', () => {
  test('onboarding overlay appears on first boot', async () => {
    fixture = await setupNoProvider()

    // The app should boot (work4you serve starts fine even without a provider),
    // but the renderer should show the onboarding overlay because no
    // provider is configured.
    await waitForOnboarding(fixture.page, 90_000)
  })

  test('onboarding shows the Work4You Portal account door', async () => {
    if (!fixture) {
      test.skip(true, 'Previous test failed — no app running')

      return
    }

    const page = fixture.page

    const rootText = await page.evaluate(() => {
      const root = document.getElementById('root')

      return root?.textContent ?? ''
    })

    expect(rootText).toMatch(/Work4You Portal/)
    expect(rootText).not.toMatch(/I'll choose a provider later/)
    expect(rootText).not.toMatch(/I have an API key/)
    expect(rootText).not.toMatch(/Other providers/)
  })

  test('screenshot of onboarding overlay', async () => {
    if (!fixture) {
      test.skip(true, 'Previous test failed — no app running')

      return
    }

    await expectVisualSnapshot(fixture.page, { name: 'onboarding-overlay', app: fixture.app })
  })
})
