import { useStore } from '@nanostores/react'
import { useCallback, useEffect, useState } from 'react'

import { FEATURED_ID, FeaturedProviderRow, providerTitle } from '@/components/onboarding'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'
import { Check, Loader2, Trash2 } from '@/lib/icons'
import { notify, notifyError } from '@/store/notifications'
import { $desktopOnboarding, startManualProviderOAuth } from '@/store/onboarding'
import type { OAuthProvider } from '@/types/work4you'
import { disconnectOAuthProvider, listOAuthProviders } from '@/work4you'

const FALLBACK_PORTAL: OAuthProvider = {
  cli_command: 'work4you login',
  docs_url: 'https://portal.work4you.ai',
  flow: 'pkce',
  id: FEATURED_ID,
  name: 'Work4You Portal',
  status: { logged_in: false }
}

/** Work4You Portal sign-in status. Other accounts and API-key forms stay off Settings. */
export function PortalAccount() {
  const { t } = useI18n()
  const copy = t.settings.providers
  const onboardingActive = useStore($desktopOnboarding).manual
  const [provider, setProvider] = useState<OAuthProvider | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const { providers } = await listOAuthProviders()
      setProvider(providers.find(item => item.id === FEATURED_ID) ?? FALLBACK_PORTAL)
    } catch {
      setProvider(FALLBACK_PORTAL)
    }
  }, [])

  useEffect(() => {
    if (onboardingActive) {
      return
    }

    void refresh()
  }, [onboardingActive, refresh])

  if (!provider) {
    return null
  }

  const portal = provider

  if (!portal.status?.logged_in) {
    return (
      <div className="mb-6">
        <FeaturedProviderRow onSelect={item => startManualProviderOAuth(item.id)} provider={portal} />
      </div>
    )
  }

  const title = providerTitle(portal)
  const canDisconnect = portal.disconnectable ?? portal.flow !== 'external'

  async function disconnect() {
    if (!window.confirm(copy.removeConfirm(title))) {
      return
    }

    setDisconnecting(true)

    try {
      await disconnectOAuthProvider(portal.id)
      notify({
        durationMs: 3_000,
        kind: 'success',
        title: copy.removedTitle,
        message: copy.removedMessage(title)
      })
      await refresh()
    } catch (err) {
      notifyError(err, copy.failedRemove(title))
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <div className="mb-6 flex items-center justify-between gap-3 rounded-[8px] bg-primary/[0.06] px-3 py-2.5">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-[length:var(--conversation-text-font-size)] font-semibold">{title}</span>
          <span className="inline-flex shrink-0 items-center gap-1 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            <Check className="size-3" />
            {copy.connected}
          </span>
        </div>
      </div>
      {canDisconnect ? (
        <Button
          aria-label={`${t.common.remove} ${title}`}
          disabled={disconnecting}
          onClick={() => void disconnect()}
          size="icon-xs"
          title={`${t.common.remove} ${title}`}
          type="button"
          variant="ghost"
        >
          {disconnecting ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
        </Button>
      ) : null}
    </div>
  )
}
