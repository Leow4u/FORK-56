import { useStore } from '@nanostores/react'
import { useEffect, useMemo, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router'

import { KbdCombo } from '@/components/ui/kbd'
import { Tip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import { triggerHaptic } from '@/lib/haptics'
import { Archive, BarChart3, Bell, Download, Info, Keyboard, Monitor, RefreshCw, Search, Upload } from '@/lib/icons'
import { isEditableTarget } from '@/lib/keybinds/combo'
import { typeToFocusChar } from '@/lib/keybinds/composer-focus-keys'
import { cn } from '@/lib/utils'
import { $commandPaletteOpen, openCommandPalettePage } from '@/store/command-palette'
import { bindingsFor } from '@/store/keybinds'
import { notifyError } from '@/store/notifications'
import { getWork4YouConfigDefaults, getWork4YouConfigRecord, saveWork4YouConfig } from '@/work4you'

import { useRouteEnumParam } from '../hooks/use-route-enum-param'
import { OverlayIconButton } from '../overlays/overlay-chrome'
import { OverlayMain, OverlayNav, type OverlayNavGroup, OverlaySplitLayout } from '../overlays/overlay-split-layout'
import { OverlayView } from '../overlays/overlay-view'
import { SKILLS_ROUTE } from '../routes'
import { MAIN_STAGE_SURFACE_CLASS } from '../shell/stage-chrome'

import { AboutSettings } from './about-settings'
import { AppSettings } from './app-settings'
import { AppearanceSettings } from './appearance-settings'
import { BillingSettings } from './billing'
import { ConfigSettings } from './config-settings'
import { SECTIONS } from './constants'
import { ImageVideoSettings } from './image-video-settings'
import { KeybindSettings } from './keybind-settings'
import { NotificationsSettings } from './notifications-settings'
import { capabilitiesSettingsRedirect, settingsTabReplacement } from './retired-settings-tabs'
import { SessionsSettings } from './sessions-settings'
import type { SettingsPageProps, SettingsView as SettingsViewId } from './types'

const SETTINGS_VIEWS: readonly SettingsViewId[] = [
  ...SECTIONS.map(s => `config:${s.id}` as SettingsViewId),
  'providers',
  // The four-mode gateway page left the menu. Kept in the enum so saved
  // `?tab=gateway` and `?tab=connections` bookmarks still resolve (Billing).
  'gateway',
  'connections',
  'keybinds',
  'app',
  'notifications',
  'billing',
  'sessions',
  'about'
]

export function SettingsView({ onClose, onConfigSaved, onMainModelChanged }: SettingsPageProps) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { hash, pathname, search } = useLocation()

  // MCP, Tools & keys, and Plugins left Settings for Capabilities. Keep old deep links
  // working — `useRouteEnumParam` would silently coerce an unknown tab to the
  // default view otherwise. Preserve `server=` so an MCP bookmark still lands
  // on (and highlights) the selected server.
  useEffect(() => {
    const params = new URLSearchParams(search)

    const tab = params.get('tab')

    if (tab === 'mcp') {
      const server = params.get('server')
      const suffix = server ? `&server=${encodeURIComponent(server)}` : ''
      navigate(`${SKILLS_ROUTE}?tab=mcp${suffix}`, { replace: true })

      return
    }

    const capabilities = capabilitiesSettingsRedirect(tab, search)

    if (capabilities) {
      navigate(capabilities, { replace: true })
    }
  }, [navigate, search])

  const [activeView, setActiveView] = useRouteEnumParam('tab', SETTINGS_VIEWS, 'config:model' as SettingsViewId)

  // Gateway topology left Settings. Old bookmarks, including the connections
  // alias, land on Billing next to the Portal account.
  useEffect(() => {
    const replacement = settingsTabReplacement(activeView)

    if (replacement) {
      setActiveView(replacement)

      return
    }

    if (activeView === 'providers') {
      setActiveView('billing')
    }
  }, [activeView, setActiveView])

  // The engine drawer left Settings. Old bookmarks land on the short App page
  // (keep awake and Quick Entry). The original tab is not in SETTINGS_VIEWS, so
  // read the query string before the enum param coerces it away.
  useEffect(() => {
    const params = new URLSearchParams(search)

    if (params.get('tab') !== 'config:advanced') {
      return
    }

    params.set('tab', 'app')
    const qs = params.toString()
    navigate({ hash, pathname, search: qs ? `?${qs}` : '' }, { replace: true })
  }, [hash, navigate, pathname, search])

  const importInputRef = useRef<HTMLInputElement | null>(null)

  const exportConfig = async () => {
    try {
      const cfg = await getWork4YouConfigRecord()
      const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'work4you-config.json'
      a.click()
      URL.revokeObjectURL(url)
      triggerHaptic('success')
    } catch (err) {
      notifyError(err, t.settings.exportFailed)
    }
  }

  const resetConfig = async () => {
    if (!window.confirm(t.settings.resetConfirm)) {
      return
    }

    try {
      await saveWork4YouConfig(await getWork4YouConfigDefaults())
      triggerHaptic('success')
      onConfigSaved?.()
    } catch (err) {
      notifyError(err, t.settings.resetFailed)
    }
  }

  const navGroups: OverlayNavGroup[] = useMemo(
    () => [
      ...SECTIONS.map(s => {
        const view = `config:${s.id}` as SettingsViewId

        return {
          active: activeView === view,
          icon: s.icon,
          id: view,
          label: t.settings.sections[s.id] ?? s.label,
          onSelect: () => setActiveView(view)
        }
      }),
      {
        active: activeView === 'app',
        icon: Monitor,
        id: 'app',
        label: t.settings.nav.app,
        onSelect: () => setActiveView('app')
      },
      {
        active: activeView === 'notifications',
        icon: Bell,
        id: 'notifications',
        label: t.settings.nav.notifications,
        onSelect: () => setActiveView('notifications')
      },
      {
        active:
          activeView === 'billing' || activeView === 'providers' || settingsTabReplacement(activeView) === 'billing',
        icon: BarChart3,
        id: 'billing',
        label: t.settings.nav.billing,
        onSelect: () => setActiveView('billing')
      },
      {
        active: activeView === 'keybinds',
        gapBefore: true,
        icon: Keyboard,
        id: 'keybinds',
        label: t.settings.nav.keybinds,
        onSelect: () => setActiveView('keybinds')
      },
      {
        active: activeView === 'sessions',
        icon: Archive,
        id: 'sessions',
        label: t.settings.nav.archivedChats,
        onSelect: () => setActiveView('sessions')
      },
      {
        active: activeView === 'about',
        gapBefore: true,
        icon: Info,
        id: 'about',
        label: t.settings.nav.about,
        onSelect: () => setActiveView('about')
      }
    ],
    [activeView, t, setActiveView]
  )

  // Type-to-search: printable keystrokes on the Settings surface (outside any
  // field) open the settings-scoped palette, seeded with the character — same
  // reflex as the chat surface's type-to-focus, pointed at search instead.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ($commandPaletteOpen.get() || isEditableTarget(event.target)) {
        return
      }

      const char = typeToFocusChar(event)

      if (char === null || char === ' ') {
        return
      }

      event.preventDefault()
      openCommandPalettePage('settings', char)
    }

    window.addEventListener('keydown', onKeyDown)

    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Search pill lives in the OverlayNav header (left rail). Clicking — or
  // typing on this surface — opens the ⌘K palette scoped to settings.
  const searchCombo = bindingsFor('nav.commandPalette')[0]
  const paletteOpen = useStore($commandPaletteOpen)

  const searchPill = (
    <button
      className={cn(
        'flex h-7 w-full items-center gap-1.5 rounded-full bg-(--ui-bg-quinary) px-2.5 text-(--ui-text-tertiary) transition-colors hover:text-foreground max-[47.5rem]:w-auto',
        paletteOpen && 'pointer-events-none opacity-0'
      )}
      onClick={() => {
        triggerHaptic('open')
        openCommandPalettePage('settings')
      }}
      tabIndex={paletteOpen ? -1 : undefined}
      type="button"
    >
      <Search className="size-3 shrink-0" />
      <span className="min-w-0 truncate text-xs max-[47.5rem]:hidden">{t.settings.search.pill}</span>
      {searchCombo && (
        <span className="ml-auto max-[47.5rem]:hidden">
          <KbdCombo combo={searchCombo} size="sm" variant="ghost" />
        </span>
      )}
    </button>
  )

  const navFooter = (
    <>
      <Tip label={t.settings.exportConfig}>
        <OverlayIconButton onClick={() => void exportConfig()}>
          <Download />
        </OverlayIconButton>
      </Tip>
      <Tip label={t.settings.importConfig}>
        <OverlayIconButton
          onClick={() => {
            triggerHaptic('open')
            importInputRef.current?.click()
          }}
        >
          <Upload />
        </OverlayIconButton>
      </Tip>
      <Tip label={t.settings.resetToDefaults}>
        <OverlayIconButton
          className="hover:text-destructive"
          onClick={() => {
            triggerHaptic('warning')
            void resetConfig()
          }}
        >
          <RefreshCw />
        </OverlayIconButton>
      </Tip>
    </>
  )

  const activeSettingsContent =
    activeView === 'config:appearance' ? (
      <AppearanceSettings />
    ) : activeView === 'config:image_video' ? (
      // Empty `keys: []` like Appearance — intercept before the generic
      // config: branch or ConfigSettings would render EmptyState.
      <ImageVideoSettings />
    ) : activeView === 'about' ? (
      <AboutSettings />
    ) : activeView === 'keybinds' ? (
      <KeybindSettings />
    ) : activeView.startsWith('config:') ? (
      <ConfigSettings
        activeSectionId={activeView.slice('config:'.length)}
        importInputRef={importInputRef}
        onConfigSaved={onConfigSaved}
        onMainModelChanged={onMainModelChanged}
      />
    ) : activeView === 'providers' || activeView === 'billing' || settingsTabReplacement(activeView) === 'billing' ? (
      // Retired gateway bookmarks render Billing immediately so the four-mode
      // page does not flash before the alias redirect.
      <BillingSettings />
    ) : activeView === 'app' ? (
      <AppSettings />
    ) : activeView === 'notifications' ? (
      <NotificationsSettings />
    ) : (
      <SessionsSettings />
    )

  return (
    <OverlayView closeLabel={t.settings.closeSettings} onClose={onClose}>
      <OverlaySplitLayout>
        <OverlayNav footer={navFooter} groups={navGroups} header={searchPill} itemTone="quiet" />

        <OverlayMain className={cn('max-w-none px-0 pb-0', MAIN_STAGE_SURFACE_CLASS)}>
          {activeSettingsContent}
        </OverlayMain>
      </OverlaySplitLayout>
    </OverlayView>
  )
}

export { SettingsView as SettingsPage }
