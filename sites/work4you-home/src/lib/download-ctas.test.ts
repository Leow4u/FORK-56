import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { closeDownloadCtas, heroDownloadCtas } from './download-ctas.ts'
import { DESKTOP_DOWNLOADS } from './downloads.ts'
import { detectGuestOS, type GuestOS } from './platform.ts'

const MAC_SAFARI =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15'
const MAC_CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
const WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
const LINUX =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'

describe('detectGuestOS', () => {
  it('treats Macintosh browsers as macOS', () => {
    assert.equal(detectGuestOS({ userAgent: MAC_SAFARI }), 'mac')
    assert.equal(detectGuestOS({ userAgent: MAC_CHROME, platform: 'MacIntel' }), 'mac')
  })

  it('keeps macOS when a Macintosh user agent also mentions Linux', () => {
    assert.equal(
      detectGuestOS({
        userAgent: `${MAC_CHROME} Linux`,
        platform: 'MacIntel',
      }),
      'mac',
    )
  })

  it('reads the client-hint platform before a conflicting user agent', () => {
    assert.equal(
      detectGuestOS({
        userAgent: LINUX,
        userAgentData: { platform: 'macOS' },
      }),
      'mac',
    )
  })

  it('detects Windows and Linux desktops', () => {
    assert.equal(detectGuestOS({ userAgent: WINDOWS }), 'windows')
    assert.equal(detectGuestOS({ userAgent: LINUX, platform: 'Linux x86_64' }), 'linux')
  })

  it('does not classify Android as a Linux desktop', () => {
    assert.equal(
      detectGuestOS({ userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8)' }),
      'mac',
    )
  })
})

describe('download CTAs', () => {
  const operatingSystems: GuestOS[] = ['mac', 'windows', 'linux']

  it('offers the macOS installer on every operating system', () => {
    for (const os of operatingSystems) {
      for (const ctas of [heroDownloadCtas(os), closeDownloadCtas(os)]) {
        const mac = ctas.find((cta) => cta.href === DESKTOP_DOWNLOADS.mac)
        assert.ok(mac, `missing macOS download for ${os}`)
        assert.equal(mac.label, 'Baixar para macOS')
      }
    }
  })

  it('keeps the Windows installer beside the macOS one', () => {
    for (const os of operatingSystems) {
      assert.ok(heroDownloadCtas(os).some((cta) => cta.href === DESKTOP_DOWNLOADS.windows))
      assert.ok(closeDownloadCtas(os).some((cta) => cta.href === DESKTOP_DOWNLOADS.windows))
    }
  })

  it('highlights the installer that matches a desktop OS', () => {
    assert.equal(
      heroDownloadCtas('mac').find((cta) => cta.tone === 'primary')?.href,
      DESKTOP_DOWNLOADS.mac,
    )
    assert.equal(
      heroDownloadCtas('windows').find((cta) => cta.tone === 'primary')?.href,
      DESKTOP_DOWNLOADS.windows,
    )
    assert.equal(
      closeDownloadCtas('windows').find((cta) => cta.tone === 'primary')?.href,
      DESKTOP_DOWNLOADS.windows,
    )
    assert.equal(
      closeDownloadCtas('mac').find((cta) => cta.tone === 'primary')?.href,
      DESKTOP_DOWNLOADS.mac,
    )
  })

  it('keeps terminal install primary on Linux and still links the macOS app', () => {
    const hero = heroDownloadCtas('linux')
    assert.equal(hero[0]?.label, 'Instalar via terminal')
    assert.equal(hero[0]?.tone, 'primary')
    assert.equal(hero.find((cta) => cta.href === DESKTOP_DOWNLOADS.mac)?.tone, 'ghost')
    assert.equal(closeDownloadCtas('linux')[0]?.href, DESKTOP_DOWNLOADS.mac)
  })
})
