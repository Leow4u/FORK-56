import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  KeyboardSensor,
  type Modifier,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useStore } from '@nanostores/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'

import { CodeEditor } from '@/components/chat/code-editor'
import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { ColorSwatches } from '@/components/ui/color-swatches'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { moodForBackendState, ProfileFace } from '@/components/ui/profile-face'
import { ProfileStateDot } from '@/components/ui/profile-state-dot'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Tip, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import { triggerHaptic } from '@/lib/haptics'
import { displayModelName } from '@/lib/model-status-label'
import { PROFILE_SWATCHES, resolveProfileColor } from '@/lib/profile-color'
import {
  REORDER_DRAG_TRANSITION_CSS,
  REORDER_RAIL_TRANSITION,
  reorderCommitHaptic,
  reorderStepHaptic
} from '@/lib/reorder'
import { useStoreSelector } from '@/lib/use-session-slice'
import { cn } from '@/lib/utils'
import { notify, notifyError } from '@/store/notifications'
import {
  $activeGatewayProfile,
  $profileBackendStates,
  $profileColors,
  $profileCreateRequest,
  $profileOrder,
  $profileRailCollapsed,
  $profiles,
  $profileScope,
  ALL_PROFILES,
  normalizeProfileKey,
  type ProfileBackendState,
  profileLabel,
  refreshActiveProfile,
  selectProfile,
  setProfileColor,
  setProfileOrder,
  setProfileRailCollapsed,
  setShowAllProfiles,
  sortByProfileOrder
} from '@/store/profile'
import { $profileLooks } from '@/store/profile-appearance'
import { runExportProfileFlow } from '@/store/profile-share'
import type { ProfileInfo } from '@/types/work4you'
import { getProfileSoul, updateProfileSoul } from '@/work4you'

import { CreateProfileDialog } from '../../profiles/create-profile-dialog'
import { DeleteProfileDialog } from '../../profiles/delete-profile-dialog'
import { RenameProfileDialog } from '../../profiles/rename-profile-dialog'
import { PROFILES_ROUTE } from '../../routes'

import { useProfilePrewarm } from './use-profile-prewarm'
import { useProfileRailRefreshOnActive } from './use-profile-rail-refresh-on-active'

const RAIL_GAP = 6 // px — matches gap-1.5 between tiles.

// Past this many profiles the strip of colored tiles stops scaling (tiny drag
// targets, endless horizontal scroll), so the rail collapses to a compact
// menu. Drag-reorder, long-press-recolor and the hover panel live only on the
// tiles path — the dropdown already lists everything by name.
const PROFILE_DROPDOWN_THRESHOLD = 13

// Hover panel timing. The dwell keeps a pointer sweeping down to the account
// row from popping the panel; the linger lets the pointer cross the gap
// between the rail and the panel without it snapping shut.
const PANEL_DWELL_MS = 150
const PANEL_LINGER_MS = 160

// Neighbors reflow on RAIL_TRANSITION; the dragged tile glides between
// snapped cells on the snappier DRAG_TRANSITION. Both come from the SHARED
// reorder primitive (lib/reorder.ts) so every reorder strip feels identical.
const RAIL_TRANSITION = REORDER_RAIL_TRANSITION
const DRAG_TRANSITION = REORDER_DRAG_TRANSITION_CSS

// The rail is a single horizontal strip of fixed cells. Pin drags to the x-axis
// (no cross-axis scrollbar), snap to whole cells so a tile steps slot-to-slot
// instead of gliding, and clamp to the occupied strip so it can't float past the
// last profile onto the "+".
const stepThroughCells: Modifier = ({ containerNodeRect, draggingNodeRect, transform }) => {
  if (!draggingNodeRect || !containerNodeRect) {
    return { ...transform, y: 0 }
  }

  const pitch = draggingNodeRect.width + RAIL_GAP
  const minX = containerNodeRect.left - draggingNodeRect.left
  const maxX = containerNodeRect.right - draggingNodeRect.right
  const snapped = Math.round(transform.x / pitch) * pitch

  return { ...transform, x: Math.min(maxX, Math.max(minX, snapped)), y: 0 }
}

const NEUTRAL_HUE = 'var(--ui-text-quaternary)'

// True when `node` sits inside a Radix menu rendered through a portal (the
// panel rows' "⋯" menus). Those live outside the panel's DOM while belonging
// to it from the user's point of view.
function isInsideFloatingMenu(node: EventTarget | null | undefined): boolean {
  return node instanceof Element && node.closest('[data-slot="dropdown-menu-content"], [role="menu"]') !== null
}

function useClearableTimer() {
  const timer = useRef<null | number>(null)

  const clear = useCallback(() => {
    if (timer.current != null) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }, [])

  const arm = useCallback(
    (fn: () => void, ms: number) => {
      clear()
      timer.current = window.setTimeout(() => {
        timer.current = null
        fn()
      }, ms)
    },
    [clear]
  )

  useEffect(() => clear, [clear])

  return { arm, clear }
}

// Profile rail at the sidebar foot: the default's home tile pinned left, the
// colored named profiles between (drag to reorder), then "+", and on the right
// the All-profiles toggle and Manage. Every tile carries its backend state as a
// dot, and the active one wears a ring in its own color — the "where am I" cue.
// Resting on the rail for a beat opens a panel above it with the active
// profile's identity, the sidebar scope switch and the other profiles by name;
// it leaves with the pointer. A click on a tile always switches immediately —
// the panel is a convenience layer, never a gate. Gateway identity lives in the
// statusbar, so this strip remains entirely available to profiles regardless
// of how many backends are registered.
export function ProfileRail() {
  const { t } = useI18n()
  const p = t.profiles
  const profiles = useStore($profiles)
  const scope = useStore($profileScope)
  const gatewayProfile = useStore($activeGatewayProfile)
  const order = useStore($profileOrder)
  const colors = useStore($profileColors)
  const states = useStore($profileBackendStates)
  const collapsed = useStore($profileRailCollapsed)
  const navigate = useNavigate()

  const [createOpen, setCreateOpen] = useState(false)
  const [pendingRename, setPendingRename] = useState<null | ProfileInfo>(null)
  const [pendingDelete, setPendingDelete] = useState<null | ProfileInfo>(null)
  const [pendingSoul, setPendingSoul] = useState<null | string>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Too many profiles for the tile strip → collapse to the select. Declared
  // ahead of the wheel effect, which re-binds when the strip mounts/unmounts.
  const condensed = profiles.length > PROFILE_DROPDOWN_THRESHOLD

  // A plain mouse wheel only emits deltaY; map it to horizontal scroll so the
  // rail is navigable without a trackpad. Trackpad x-scroll (deltaX) passes
  // through. Native + non-passive so we can preventDefault and not bleed the
  // gesture into the sessions list above.
  useEffect(() => {
    const el = scrollRef.current

    if (!el) {
      return
    }

    const onWheel = (event: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
        return
      }

      el.scrollLeft += event.deltaY
      event.preventDefault()
    }

    el.addEventListener('wheel', onWheel, { passive: false })

    return () => el.removeEventListener('wheel', onWheel)
    // `condensed` swaps the strip out for the dropdown, `collapsed` for the
    // one-line fold (ref goes null/back either way).
  }, [collapsed, condensed])

  const isAll = scope === ALL_PROFILES
  const activeKey = normalizeProfileKey(gatewayProfile)
  const defaultProfile = profiles.find(profile => profile.is_default)
  const activeProfile = profiles.find(profile => normalizeProfileKey(profile.name) === activeKey) ?? defaultProfile

  const named = sortByProfileOrder(
    profiles.filter(profile => !profile.is_default),
    order
  )

  const multiProfile = profiles.length > 1

  const stateOf = (profile: Pick<ProfileInfo, 'name'>): ProfileBackendState =>
    states[normalizeProfileKey(profile.name)] ?? 'asleep'

  // ── Hover panel ──────────────────────────────────────────────────────────
  const [panelOpen, setPanelOpen] = useState(false)
  const openTimer = useClearableTimer()
  const closeTimer = useClearableTimer()
  const draggingRef = useRef(false)
  // Pointer is over the rail or the panel. Kept in a ref: it only decides
  // whether to arm a close, never paints.
  const hoveringRef = useRef(false)
  // A row's "⋯" menu is open. Its content portals OUTSIDE the panel, so the
  // pointer moving onto it fires the panel's pointerleave and the click lands
  // as an "outside interaction" — both would shut the panel under the menu.
  // While a menu is up the panel is pinned; it re-evaluates when the menu goes.
  const menuOpenRef = useRef(false)

  const closePanel = useCallback(() => {
    openTimer.clear()
    closeTimer.clear()
    setPanelOpen(false)
  }, [closeTimer, openTimer])

  const armOpen = () => {
    hoveringRef.current = true
    closeTimer.clear()

    if (draggingRef.current || condensed || !multiProfile) {
      return
    }

    openTimer.arm(() => setPanelOpen(true), PANEL_DWELL_MS)
  }

  const armClose = () => {
    openTimer.clear()

    if (menuOpenRef.current) {
      return
    }

    closeTimer.arm(() => setPanelOpen(false), PANEL_LINGER_MS)
  }

  // pointerleave from the rail or the panel. Leaving INTO a portaled row menu
  // is not leaving the panel: the menu is part of it, just not in its DOM.
  const leaveTowards = (event: React.PointerEvent) => {
    hoveringRef.current = false

    if (isInsideFloatingMenu(event.relatedTarget)) {
      return
    }

    armClose()
  }

  const enterPanel = () => {
    hoveringRef.current = true
    closeTimer.clear()
  }

  const handleRowMenuOpenChange = (open: boolean) => {
    menuOpenRef.current = open

    if (open) {
      openTimer.clear()
      closeTimer.clear()

      return
    }

    // Menu gone (item picked, Escape, click elsewhere). Whoever handled the
    // item may already have closed the panel; otherwise close it unless the
    // pointer has come back onto the rail/panel in the meantime.
    if (!hoveringRef.current) {
      armClose()
    }
  }

  // Any dialog the rail opens takes over the pointer; drop the panel first so
  // it isn't left floating behind the modal.
  const openCreate = () => {
    closePanel()
    setCreateOpen(true)
  }

  const openRename = (profile: ProfileInfo) => {
    closePanel()
    setPendingRename(profile)
  }

  const openDelete = (profile: ProfileInfo) => {
    closePanel()
    setPendingDelete(profile)
  }

  const openSoul = (name: string) => {
    closePanel()
    setPendingSoul(name)
  }

  const pick = (name: string) => {
    closePanel()
    selectProfile(name)
  }

  const openManage = () => {
    closePanel()
    navigate(PROFILES_ROUTE)
  }

  // Fold / unfold. Both drop the panel: the anchor is about to change shape
  // under it, and the strip re-arms the panel on the next hover anyway.
  const foldRail = (fold: boolean) => {
    closePanel()
    setProfileRailCollapsed(fold)
  }

  // distance constraint: a small drag reorders, a tap still selects the profile.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // Tick a haptic each time the drag crosses into a new cell, and a satisfying
  // confirm on a committed reorder.
  const lastOverRef = useRef<string | null>(null)

  const handleDragStart = ({ active }: DragStartEvent) => {
    lastOverRef.current = String(active.id)
    draggingRef.current = true
    closePanel()
  }

  const handleDragOver = ({ over }: DragOverEvent) => {
    const id = over ? String(over.id) : null

    if (id && id !== lastOverRef.current) {
      lastOverRef.current = id
      reorderStepHaptic()
    }
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    lastOverRef.current = null
    draggingRef.current = false

    if (!over || active.id === over.id) {
      return
    }

    const ids = named.map(profile => profile.name)
    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))

    if (from >= 0 && to >= 0) {
      setProfileOrder(arrayMove(ids, from, to))
      reorderCommitHaptic()
    }
  }

  // Re-pull the running profile + list on mount, and again whenever the window
  // regains focus/visibility -- a profile created, deleted, or renamed by
  // another surface (Manage Profiles, another window, the CLI) leaves this
  // rail's cached $profiles stale until something re-fetches it. See
  // use-profile-rail-refresh-on-active.ts for the extracted (and tested)
  // wiring.
  useProfileRailRefreshOnActive()

  // Open the create dialog when the `profile.create` hotkey fires (the dialog
  // state lives here, so the global keybind bumps a request atom we watch).
  const createRequest = useStore($profileCreateRequest)
  const lastCreateRef = useRef(createRequest)

  // eslint-disable-next-line no-restricted-syntax -- legitimate non-atom ref write (see eslint rule comment)
  useEffect(() => {
    if (createRequest === lastCreateRef.current) {
      return
    }

    lastCreateRef.current = createRequest
    setCreateOpen(true)
  }, [createRequest])

  return (
    <Popover
      onOpenChange={open => {
        // Radix asks to close on Escape / outside interaction. A click inside a
        // row's portaled menu is such an "outside" — keep the panel for it.
        if (!open && !menuOpenRef.current) {
          closePanel()
        }
      }}
      open={panelOpen && !condensed && multiProfile}
    >
      <PopoverAnchor asChild>
        <div
          aria-label={p.title}
          className="flex min-w-0 items-center gap-1"
          data-slot="profile-rail"
          onPointerEnter={armOpen}
          onPointerLeave={leaveTowards}
          role="group"
        >
          {collapsed ? (
            // Folded: one line, the active profile and a way back. Hovering
            // still raises the panel (multi-profile only, as everywhere), so
            // nothing the rail can do is lost — only the tile strip is.
            activeProfile && (
              <CollapsedRail
                label={isAll ? p.allProfiles : profileLabel(activeProfile)}
                onExpand={() => foldRail(false)}
                profile={activeProfile}
                state={stateOf(activeProfile)}
                tipsEnabled={!panelOpen}
              />
            )
          ) : (
            <>
              {/* Default pinned left as its own tile: always "go home", never a
              disguised All toggle (that is the layers button on the right). */}
              {defaultProfile && (
                <ProfileTileButton
                  active={!isAll && activeKey === 'default'}
                  label={profileLabel(defaultProfile)}
                  name={defaultProfile.name}
                  onSelect={() => pick(defaultProfile.name)}
                  state={stateOf(defaultProfile)}
                  stateLabel={p.state[stateOf(defaultProfile)]}
                  tip={
                    !isAll && activeKey === 'default'
                      ? profileLabel(defaultProfile)
                      : p.switchToProfile(profileLabel(defaultProfile))
                  }
                  tipsEnabled={!panelOpen}
                />
              )}

              {condensed ? (
                // Condensed path: one compact dropdown instead of N tiles. No drag
                // reorder, no long-press recolor, no per-tile context menu — Manage
                // covers rename/delete at this scale.
                <div className="flex min-w-0 flex-1 items-center gap-1">
                  <ProfileDropdown
                    activeKey={isAll ? null : activeKey}
                    colors={colors}
                    onCreate={openCreate}
                    onSelect={selectProfile}
                    profiles={named}
                  />
                </div>
              ) : (
                <div
                  className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  ref={scrollRef}
                >
                  {multiProfile && (
                    <DndContext
                      collisionDetection={closestCenter}
                      modifiers={[stepThroughCells]}
                      onDragEnd={handleDragEnd}
                      onDragOver={handleDragOver}
                      onDragStart={handleDragStart}
                      sensors={sensors}
                    >
                      <SortableContext
                        items={named.map(profile => profile.name)}
                        strategy={horizontalListSortingStrategy}
                      >
                        {/* relative → the strip is the dragged tile's offsetParent, so the
                        clamp modifier bounds drags to the occupied cells (not the +). */}
                        <div className="relative flex items-center gap-1.5">
                          {named.map(profile => (
                            <ProfileSquare
                              active={!isAll && normalizeProfileKey(profile.name) === activeKey}
                              color={resolveProfileColor(profile.name, colors)}
                              key={profile.name}
                              label={profileLabel(profile)}
                              name={profile.name}
                              onDelete={() => openDelete(profile)}
                              onEditSoul={() => openSoul(profile.name)}
                              onRecolor={color => setProfileColor(profile.name, color)}
                              onRename={() => openRename(profile)}
                              onSelect={() => pick(profile.name)}
                              state={stateOf(profile)}
                              stateLabel={p.state[stateOf(profile)]}
                              tip={
                                !isAll && normalizeProfileKey(profile.name) === activeKey
                                  ? profileLabel(profile)
                                  : p.switchToProfile(profileLabel(profile))
                              }
                              tipsEnabled={!panelOpen}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  )}

                  <AddProfileButton label={p.newProfile} onClick={openCreate} />
                </div>
              )}

              {/* All-profiles toggle, its own button so "show everything" and
              "go to default" are never the same control. Hidden until a second
              profile exists — one profile has nothing to fan out. */}
              {multiProfile && (
                <ProfilePill
                  active={isAll}
                  glyph="layers"
                  label={isAll ? p.showingAllProfiles : p.showAllProfiles}
                  onSelect={() => {
                    closePanel()
                    setShowAllProfiles(!isAll)
                  }}
                />
              )}

              {/* Always reachable, even with only the default profile: the manage
              overlay is the only place to edit a profile's SOUL.md, and a
              single-profile user must be able to edit the default's persona
              without first creating a throwaway second profile. */}
              <ProfilePill active={false} glyph="ellipsis" label={p.manageProfiles} onSelect={openManage} />

              <RailFoldButton label={p.collapseRail} onSelect={() => foldRail(true)} />
            </>
          )}
        </div>
      </PopoverAnchor>

      <PopoverContent
        align="start"
        aria-label={p.switcher}
        className="w-(--radix-popover-trigger-width) min-w-56 max-w-72 p-0"
        collisionPadding={{ bottom: 44, left: 8, right: 8, top: 8 }}
        data-slot="profile-rail-panel"
        onInteractOutside={event => {
          // Pointer-down / focus inside a row's portaled menu is not "outside".
          if (menuOpenRef.current || isInsideFloatingMenu(event.detail.originalEvent.target)) {
            event.preventDefault()
          }
        }}
        onOpenAutoFocus={event => event.preventDefault()}
        onPointerEnter={enterPanel}
        onPointerLeave={leaveTowards}
        side="top"
        sideOffset={6}
      >
        {activeProfile && (
          <RailPanel
            activeProfile={activeProfile}
            colors={colors}
            isAll={isAll}
            onCreate={openCreate}
            onDelete={openDelete}
            onEditSoul={openSoul}
            onExport={name => void runExportProfileFlow(name)}
            onManage={openManage}
            onMenuOpenChange={handleRowMenuOpenChange}
            onRename={openRename}
            onScope={all => setShowAllProfiles(all)}
            onSelect={pick}
            others={[
              ...(defaultProfile && defaultProfile !== activeProfile ? [defaultProfile] : []),
              ...named.filter(profile => profile !== activeProfile)
            ]}
            stateOf={stateOf}
          />
        )}
      </PopoverContent>

      {/* Land in the new profile on a fresh chat (selectProfile triggers the
          new-session reset), not stuck on the session you were just in. */}
      <CreateProfileDialog
        onClose={() => setCreateOpen(false)}
        onCreated={async (name, { switchTo }) => {
          await refreshActiveProfile()

          if (switchTo) {
            selectProfile(name)
          }
        }}
        open={createOpen}
        profiles={profiles}
        showSwitchOption
      />

      <RenameProfileDialog
        currentName={pendingRename?.name ?? ''}
        isDefault={pendingRename?.is_default ?? false}
        onClose={() => setPendingRename(null)}
        onRenamed={refreshActiveProfile}
        open={pendingRename !== null}
      />

      <DeleteProfileDialog
        onClose={() => setPendingDelete(null)}
        onDeleted={refreshActiveProfile}
        open={pendingDelete !== null}
        profile={pendingDelete}
      />

      <EditSoulDialog onClose={() => setPendingSoul(null)} profileName={pendingSoul} />
    </Popover>
  )
}

// ── Hover panel ──────────────────────────────────────────────────────────────

interface RailPanelProps {
  activeProfile: ProfileInfo
  colors: Record<string, string>
  isAll: boolean
  onCreate: () => void
  onDelete: (profile: ProfileInfo) => void
  onEditSoul: (name: string) => void
  onExport: (name: string) => void
  onManage: () => void
  /** A row's "⋯" menu opened or closed — the rail pins the panel meanwhile. */
  onMenuOpenChange: (open: boolean) => void
  onRename: (profile: ProfileInfo) => void
  onScope: (all: boolean) => void
  onSelect: (name: string) => void
  others: ProfileInfo[]
  stateOf: (profile: Pick<ProfileInfo, 'name'>) => ProfileBackendState
}

// What the rail says when you rest on it: who you are (name, model, backend
// state), the sidebar scope, and the other profiles by name with their own
// state — so a cold switch is a known cost, not a surprise hang.
function RailPanel({
  activeProfile,
  colors,
  isAll,
  onCreate,
  onDelete,
  onEditSoul,
  onExport,
  onManage,
  onMenuOpenChange,
  onRename,
  onScope,
  onSelect,
  others,
  stateOf
}: RailPanelProps) {
  const { t } = useI18n()
  const p = t.profiles
  const activeKey = normalizeProfileKey(activeProfile.name)
  // The band and the face agree: both come from the bot's resolved look.
  const activeHue = useStoreSelector($profileLooks, looks => looks[activeKey]?.appearance.color) ?? null
  const activeState = stateOf(activeProfile)

  return (
    <div className="flex flex-col text-xs">
      <div
        className="flex items-center gap-2.5 px-2.5 py-2"
        style={{ boxShadow: `inset 3px 0 0 ${activeHue ?? NEUTRAL_HUE}` }}
      >
        <ProfileAvatar name={activeProfile.name} size={32} state={activeState} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[0.8125rem] font-semibold text-foreground">{profileLabel(activeProfile)}</span>
          <span className="truncate text-[0.6875rem] text-(--ui-text-tertiary)">
            {[activeProfile.model ? displayModelName(activeProfile.model) : null, p.state[activeState]]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </div>
        <Tip label={p.editSoul}>
          <Button
            aria-label={p.editSoul}
            className="text-(--ui-text-tertiary)"
            onClick={() => onEditSoul(activeProfile.name)}
            size="icon-xs"
            type="button"
            variant="ghost"
          >
            <Codicon name="edit" size="0.8rem" />
          </Button>
        </Tip>
      </div>

      <div className="px-2.5 pb-2">
        <SegmentedControl
          className="w-full"
          onChange={id => onScope(id === 'all')}
          options={[
            { id: 'this', label: p.thisProfile },
            { id: 'all', label: p.allProfiles }
          ]}
          value={isAll ? 'all' : 'this'}
        />
      </div>

      {others.length > 0 && (
        <div className="flex flex-col gap-px border-t border-(--ui-border) p-1">
          <span className="px-2 pb-0.5 pt-1 text-[0.625rem] font-semibold uppercase tracking-wider text-(--ui-text-tertiary)">
            {p.switchTo}
          </span>
          {others.map(profile => (
            <RailPanelRow
              hue={profile.is_default ? null : resolveProfileColor(profile.name, colors)}
              key={profile.name}
              onDelete={profile.is_default ? undefined : () => onDelete(profile)}
              onEditSoul={() => onEditSoul(profile.name)}
              onExport={() => onExport(profile.name)}
              onMenuOpenChange={onMenuOpenChange}
              onRename={() => onRename(profile)}
              onSelect={() => onSelect(profile.name)}
              profile={profile}
              state={stateOf(profile)}
            />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-(--ui-border) px-1 py-1">
        <Button className="gap-1.5 text-foreground" onClick={onCreate} size="xs" type="button" variant="ghost">
          <Codicon name="add" size="0.75rem" />
          {p.newProfile}
        </Button>
        <Button className="text-(--ui-text-tertiary)" onClick={onManage} size="xs" type="button" variant="ghost">
          {p.manageShort}
        </Button>
      </div>
    </div>
  )
}

function RailPanelRow({
  hue,
  onDelete,
  onEditSoul,
  onExport,
  onMenuOpenChange,
  onRename,
  onSelect,
  profile,
  state
}: {
  hue: null | string
  onDelete?: () => void
  onEditSoul: () => void
  onExport: () => void
  onMenuOpenChange: (open: boolean) => void
  onRename: () => void
  onSelect: () => void
  profile: ProfileInfo
  state: ProfileBackendState
}) {
  const { t } = useI18n()
  const p = t.profiles
  const { cancelPrewarm, startPrewarm } = useProfilePrewarm(profile.name)
  const label = profileLabel(profile)

  return (
    <div className="group/row flex items-center gap-1 rounded-md hover:bg-(--ui-control-hover-background)">
      <button
        aria-label={p.switchToProfile(label)}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1 text-left"
        onClick={onSelect}
        onPointerEnter={startPrewarm}
        onPointerLeave={cancelPrewarm}
        type="button"
      >
        <ProfileAvatar name={profile.name} size={24} state={state} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-xs font-semibold text-foreground">{label}</span>
          <span className="truncate text-[0.625rem] text-(--ui-text-tertiary)">
            {[profile.model ? displayModelName(profile.model) : null, p.state[state]].filter(Boolean).join(' · ')}
          </span>
        </span>
      </button>
      <DropdownMenu onOpenChange={onMenuOpenChange}>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={`${p.actions}: ${label}`}
            className="mr-0.5 text-(--ui-text-tertiary) opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
            size="icon-xs"
            type="button"
            variant="ghost"
          >
            <Codicon name="ellipsis" size="0.8rem" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40" side="right">
          <DropdownMenuItem onSelect={onEditSoul}>
            <Codicon name="edit" size="0.875rem" />
            <span>{p.editSoul}</span>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onRename}>
            <Codicon name="text-size" size="0.875rem" />
            <span>{p.renameMenu}</span>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onExport}>
            <Codicon name="package" size="0.875rem" />
            <span>{p.exportProfile}</span>
          </DropdownMenuItem>
          {onDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onDelete} variant="destructive">
                <Codicon name="trash" size="0.875rem" />
                <span>{t.common.delete}</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

// ── Avatar ─────────────────────────────────────────────────────────────────

// The bot's face used by the panel, the backend state dot in the corner.
// Bigger than the rail tiles on purpose — this is the identity card, not a
// list lead. An asleep bot is dimmed the way its tile is.
function ProfileAvatar({ name, size, state }: { name: string; size: number; state: ProfileBackendState }) {
  return (
    <span
      className="relative inline-grid shrink-0 place-items-center"
      style={{ height: size, opacity: state === 'asleep' ? 0.6 : 1, width: size }}
    >
      <ProfileFace mood={moodForBackendState(state)} name={name} size={size} />
      <ProfileStateDot state={state} />
    </span>
  )
}

/** The ring a tile wears while active: the bot's own color, so the ring and
 *  the face belong together. */
function useTileRingColor(name: string): string {
  const key = normalizeProfileKey(name)

  return useStoreSelector($profileLooks, looks => looks[key]?.appearance.color) ?? NEUTRAL_HUE
}

// The default tile and (via ProfileSquare) the named tiles share this look:
// 26px cell, the bot's face, state dot, active ring in the bot's own color.
function ProfileTileButton({
  active,
  label,
  name,
  onSelect,
  state,
  stateLabel,
  tip,
  tipsEnabled = true
}: {
  active: boolean
  label: string
  name: string
  onSelect: () => void
  state: ProfileBackendState
  stateLabel: string
  tip: string
  /** False while the hover panel is up: it already says all the tooltip would. */
  tipsEnabled?: boolean
}) {
  const ringColor = useTileRingColor(name)

  return (
    <Tip label={tipsEnabled ? `${tip} · ${stateLabel}` : ''}>
      <button
        aria-label={label}
        aria-pressed={active}
        className={cn(
          'relative grid size-[26px] shrink-0 place-items-center rounded-md transition-opacity hover:opacity-100',
          active ? 'opacity-100' : state === 'asleep' ? 'opacity-55' : 'opacity-80'
        )}
        onClick={onSelect}
        style={{
          boxShadow: active ? `0 0 0 1.5px var(--background), 0 0 0 3px ${ringColor}` : undefined
        }}
        type="button"
      >
        <ProfileFace mood={moodForBackendState(state)} name={name} size={24} />
        <ProfileStateDot state={state} />
      </button>
    </Tip>
  )
}

// ── Dialogs / small parts ──────────────────────────────────────────────────

// Right-click → Edit SOUL.md for a sidebar profile — the same in-app markdown
// editor as the memory-graph node edit, so a profile's persona is editable
// without opening the Manage overlay.
function EditSoulDialog({ onClose, profileName }: { onClose: () => void; profileName: null | string }) {
  const { t } = useI18n()
  const p = t.profiles
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!profileName) {
      return
    }

    let cancelled = false
    setLoading(true)
    setContent('')

    getProfileSoul(profileName)
      .then(soul => !cancelled && setContent(soul.content))
      .catch(err => !cancelled && notifyError(err, p.failedLoadSoul))
      .finally(() => !cancelled && setLoading(false))

    return () => void (cancelled = true)
  }, [p, profileName])

  const save = async () => {
    if (!profileName) {
      return
    }

    setSaving(true)

    try {
      await updateProfileSoul(profileName, content)
      notify({ kind: 'success', title: p.soulSaved, message: profileName })
      onClose()
    } catch (err) {
      notifyError(err, p.failedSaveSoul)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog onOpenChange={open => !open && !saving && onClose()} open={profileName !== null}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{profileName} · SOUL.md</DialogTitle>
        </DialogHeader>
        <div className="h-80">
          {!loading && profileName && (
            <CodeEditor
              filePath="SOUL.md"
              framed
              initialValue={content}
              key={profileName}
              onCancel={() => !saving && onClose()}
              onChange={setContent}
              onSave={() => void save()}
            />
          )}
        </div>
        <DialogFooter>
          <Button disabled={saving} onClick={onClose} type="button" variant="ghost">
            {t.common.cancel}
          </Button>
          <Button disabled={saving || loading} onClick={() => void save()}>
            {saving ? p.saving : p.saveSoul}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// The "+" create button, shared by both rail render paths.
function AddProfileButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Tip label={label}>
      <button
        aria-label={label}
        className="grid size-[22px] shrink-0 place-items-center rounded-[4px] text-(--ui-text-tertiary) opacity-55 transition hover:bg-(--ui-control-hover-background) hover:text-foreground hover:opacity-100"
        onClick={onClick}
        type="button"
      >
        <Codicon name="add" size="0.75rem" />
      </button>
    </Tip>
  )
}

// The condensed rail: every named profile in one compact menu. The trigger
// shows the active profile (tinted initial + name); on default/all scope it
// falls back to the placeholder since the home tile carries that state.
function ProfileDropdown({
  activeKey,
  colors,
  onCreate,
  onSelect,
  profiles
}: {
  activeKey: null | string
  colors: Record<string, string>
  onCreate: () => void
  onSelect: (name: string) => void
  profiles: ProfileInfo[]
}) {
  const { t } = useI18n()
  const p = t.profiles

  const value = activeKey ? (profiles.find(profile => normalizeProfileKey(profile.name) === activeKey)?.name ?? '') : ''
  const activeProfile = profiles.find(profile => profile.name === value)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={p.title}
          className="min-w-0 flex-1 justify-between overflow-hidden px-1 text-(--ui-text-secondary) data-[state=open]:bg-(--ui-control-active-background) data-[state=open]:text-foreground"
          data-slot="profile-dropdown"
          size="xs"
          type="button"
          variant="ghost"
        >
          <span className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
            {activeProfile ? (
              <>
                <ProfileFace name={activeProfile.name} size={16} />
                <span className="truncate">{profileLabel(activeProfile)}</span>
              </>
            ) : (
              <span className="truncate">{p.title}</span>
            )}
          </span>
          <Codicon aria-hidden="true" className="shrink-0 opacity-60" name="chevron-down" size="0.875rem" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-48 max-w-72" collisionPadding={8} side="top">
        <DropdownMenuItem onSelect={onCreate}>
          <Codicon aria-hidden="true" name="add" size="0.875rem" />
          <span className="truncate">{p.newProfile}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup onValueChange={name => name && onSelect(name)} value={value}>
          {profiles.map(profile => (
            <ProfileDropdownItem
              color={resolveProfileColor(profile.name, colors)}
              key={profile.name}
              label={profileLabel(profile)}
              name={profile.name}
            />
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// One dropdown row per profile — its own component so each row can own a
// hover-intent prewarm timer (see useProfilePrewarm).
function ProfileDropdownItem({ color, label, name }: { color: null | string; label: string; name: string }) {
  const { cancelPrewarm, startPrewarm } = useProfilePrewarm(name)

  return (
    <DropdownMenuRadioItem
      className="min-w-0"
      onPointerEnter={startPrewarm}
      onPointerLeave={cancelPrewarm}
      value={name}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <ProfileFace name={name} size={16} />
        <span className="truncate">{label}</span>
      </span>
    </DropdownMenuRadioItem>
  )
}

interface ProfilePillProps {
  active: boolean
  // All / Manage are glyph action buttons (navigation, not identity).
  glyph: string
  label: string
  onSelect: () => void
}

function ProfilePill({ active, glyph, label, onSelect }: ProfilePillProps) {
  return (
    <Tip label={label}>
      <Button
        aria-label={label}
        aria-pressed={active}
        className={cn(
          'bg-transparent text-(--ui-text-tertiary) hover:bg-(--ui-control-hover-background) hover:text-foreground',
          active && 'bg-foreground text-background hover:bg-foreground hover:text-background'
        )}
        onClick={onSelect}
        size="icon-xs"
        type="button"
        variant="ghost"
      >
        <Codicon name={glyph} size="0.875rem" />
      </Button>
    </Tip>
  )
}

// The ▾ at the rail's right end. Not a ProfilePill: it is never "pressed",
// it changes what the rail IS, so it carries aria-expanded instead.
function RailFoldButton({ label, onSelect }: { label: string; onSelect: () => void }) {
  return (
    <Tip label={label}>
      <Button
        aria-expanded
        aria-label={label}
        className="bg-transparent text-(--ui-text-tertiary) hover:bg-(--ui-control-hover-background) hover:text-foreground"
        data-slot="profile-rail-fold"
        onClick={onSelect}
        size="icon-xs"
        type="button"
        variant="ghost"
      >
        <Codicon name="chevron-down" size="0.875rem" />
      </Button>
    </Tip>
  )
}

// The folded rail: one 24px line that is a single button. Click unfolds; the
// pointer resting on it raises the hover panel through the shared anchor, so
// switching, All, New and Manage are still one gesture away while folded.
function CollapsedRail({
  label,
  onExpand,
  profile,
  state,
  tipsEnabled
}: {
  label: string
  onExpand: () => void
  profile: ProfileInfo
  state: ProfileBackendState
  /** False while the hover panel is up: it already says all the tooltip would. */
  tipsEnabled: boolean
}) {
  const { t } = useI18n()
  const p = t.profiles

  return (
    <Tip label={tipsEnabled ? p.expandRail : ''}>
      <button
        aria-expanded={false}
        aria-label={p.collapsedRail(label)}
        className={cn(
          'flex h-6 min-w-0 flex-1 items-center gap-2 rounded-md px-1 text-left text-[0.6875rem]',
          'text-(--ui-text-tertiary) transition-colors duration-100 ease-out',
          'hover:bg-(--ui-control-hover-background) hover:text-foreground hover:transition-none'
        )}
        data-slot="profile-rail-collapsed"
        onClick={onExpand}
        type="button"
      >
        <ProfileAvatar name={profile.name} size={18} state={state} />
        <span className="truncate">{label}</span>
        <Codicon className="ml-auto shrink-0" name="chevron-up" size="0.8rem" />
      </button>
    </Tip>
  )
}

interface ProfileSquareProps {
  active: boolean
  color: null | string
  label: string
  name: string
  onSelect: () => void
  onRecolor: (color: null | string) => void
  onRename: () => void
  onEditSoul: () => void
  onDelete: () => void
  state: ProfileBackendState
  stateLabel: string
  tip: string
  /** False while the hover panel is up: it already says all the tooltip would. */
  tipsEnabled?: boolean
}

// Hold this long without moving (a drag would have started first) to open the
// color picker — the "hard press" gesture, distinct from tap-to-select.
const LONG_PRESS_MS = 450

// A profile *is* its colored tile — no icon-button chrome. Full hue with the
// white initial, the backend state in the corner; the active one wears a ring
// in its own color. These pack tightly so the rail reads as a strip of
// profiles, drag-sort to reorder (a tap below the drag threshold still
// selects), and right-click to rename/delete. The button carries both the
// tooltip and context-menu triggers via nested asChild Slots, so a single
// element keeps the dnd listeners, hover tip, and right-click menu.
function ProfileSquare({
  active,
  color,
  label,
  name,
  onDelete,
  onEditSoul,
  onRecolor,
  onRename,
  onSelect,
  state,
  stateLabel,
  tip,
  tipsEnabled = true
}: ProfileSquareProps) {
  const { t } = useI18n()
  const p = t.profiles
  const hue = useTileRingColor(name)
  const [pickerOpen, setPickerOpen] = useState(false)
  const pressTimer = useRef<null | number>(null)
  const suppressClick = useRef(false)
  // Hovering a tile telegraphs the switch — start that profile's backend
  // spawn now so a cold click doesn't pay the full boot.
  const { cancelPrewarm, startPrewarm } = useProfilePrewarm(label)

  const { attributes, isDragging, listeners, setNodeRef, transform, transition } = useSortable({
    id: label,
    transition: RAIL_TRANSITION
  })

  const clearPress = () => {
    if (pressTimer.current != null) {
      clearTimeout(pressTimer.current)
      pressTimer.current = null
    }
  }

  // A real drag (movement past the dnd threshold) cancels the pending hold, so a
  // reorder never doubles as a color pick. Also tidy up on unmount.
  useEffect(() => {
    if (isDragging) {
      clearPress()
    }
  }, [isDragging])
  useEffect(() => clearPress, [])

  const base = CSS.Transform.toString(transform)
  const ring = active ? `0 0 0 1.5px var(--background), 0 0 0 3px ${hue}` : ''
  const lift = isDragging ? '0 6px 16px -4px rgb(0 0 0 / 0.4)' : ''

  const pickColor = (next: null | string) => {
    onRecolor(next)
    setPickerOpen(false)
    triggerHaptic('selection')
  }

  return (
    <Popover onOpenChange={setPickerOpen} open={pickerOpen}>
      <ContextMenu>
        <TooltipProvider delayDuration={0}>
          {/* Controlled shut while the panel is open; uncontrolled otherwise. */}
          <Tooltip open={tipsEnabled ? undefined : false}>
            <PopoverAnchor asChild>
              <ContextMenuTrigger asChild>
                <TooltipTrigger asChild>
                  <button
                    className={cn(
                      'relative grid size-[26px] shrink-0 cursor-grab touch-none select-none place-items-center rounded-md transition-opacity hover:opacity-100',
                      active ? 'opacity-100' : state === 'asleep' ? 'opacity-55' : 'opacity-80',
                      isDragging && 'z-10 cursor-grabbing opacity-100'
                    )}
                    ref={setNodeRef}
                    style={{
                      boxShadow: [ring, lift].filter(Boolean).join(', ') || undefined,
                      // Glide the dragged tile between snapped cells with a little
                      // overshoot (no scale — the overflow-x strip would clip it).
                      transform: base,
                      transition: isDragging ? DRAG_TRANSITION : transition
                    }}
                    type="button"
                    {...attributes}
                    {...listeners}
                    aria-label={label}
                    aria-pressed={active}
                    // Hold-to-recolor rides alongside the dnd pointer listener (call
                    // it first so drag tracking still arms), then a timer opens the
                    // picker and flags the trailing click so it doesn't also select.
                    onClick={() => {
                      if (suppressClick.current) {
                        suppressClick.current = false

                        return
                      }

                      onSelect()
                    }}
                    onPointerCancel={clearPress}
                    onPointerDown={event => {
                      listeners?.onPointerDown?.(event)

                      if (event.button !== 0) {
                        return
                      }

                      suppressClick.current = false
                      clearPress()
                      pressTimer.current = window.setTimeout(() => {
                        suppressClick.current = true
                        triggerHaptic('success')
                        setPickerOpen(true)
                      }, LONG_PRESS_MS)
                    }}
                    onPointerEnter={startPrewarm}
                    onPointerLeave={() => {
                      clearPress()
                      cancelPrewarm()
                    }}
                    onPointerUp={clearPress}
                  >
                    <ProfileFace mood={moodForBackendState(state)} name={name} size={24} />
                    <ProfileStateDot state={state} />
                  </button>
                </TooltipTrigger>
              </ContextMenuTrigger>
            </PopoverAnchor>
            <TooltipContent>
              {tip} · {stateLabel}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* The rail sits at the very bottom, so pad off the chrome (esp. the
            statusbar) — Radix then flips the menu up instead of squishing it. */}
        <ContextMenuContent
          aria-label={p.actions}
          className="w-40"
          collisionPadding={{ bottom: 44, left: 8, right: 8, top: 8 }}
          // Menu close refocuses the trigger — which doubles as the popover
          // anchor — so the picker reads it as focus-outside and dies on open.
          // Suppress the refocus and the picker survives.
          onCloseAutoFocus={event => event.preventDefault()}
        >
          <ContextMenuItem onSelect={() => setPickerOpen(true)}>
            <Codicon name="symbol-color" size="0.875rem" />
            <span>{p.color}</span>
          </ContextMenuItem>
          <ContextMenuItem onSelect={onRename}>
            <Codicon name="text-size" size="0.875rem" />
            <span>{p.renameMenu}</span>
          </ContextMenuItem>
          <ContextMenuItem onSelect={onEditSoul}>
            <Codicon name="edit" size="0.875rem" />
            <span>{p.editSoul}</span>
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => void runExportProfileFlow(label)}>
            <Codicon name="package" size="0.875rem" />
            <span>{p.exportProfile}</span>
          </ContextMenuItem>
          <ContextMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={onDelete}
            variant="destructive"
          >
            <Codicon name="trash" size="0.875rem" />
            <span>{t.common.delete}</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <PopoverContent
        aria-label={p.colorFor}
        className="w-auto p-2"
        collisionPadding={{ bottom: 44, left: 8, right: 8, top: 8 }}
        side="top"
      >
        <ColorSwatches
          clearIcon="sync"
          clearLabel={p.autoColor}
          onChange={pickColor}
          swatches={PROFILE_SWATCHES}
          swatchLabel={p.setColor}
          value={color}
        />
      </PopoverContent>
    </Popover>
  )
}
