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
import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { ColorSwatches } from '@/components/ui/color-swatches'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu'
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { moodForBackendState, ProfileFace } from '@/components/ui/profile-face'
import { ProfileStateDot } from '@/components/ui/profile-state-dot'
import { Switch } from '@/components/ui/switch'
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
import {
  $activeGatewayProfile,
  $gatewaySwapTarget,
  $profileBackendStates,
  $profileColors,
  $profileCreateRequest,
  $profileOrder,
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
  setShowAllProfiles,
  sortByProfileOrder
} from '@/store/profile'
import { $profileLooks } from '@/store/profile-appearance'
import { runExportProfileFlow } from '@/store/profile-share'
import type { ProfileInfo } from '@/types/work4you'

import { CreateProfileDialog } from '../../profiles/create-profile-dialog'
import { DeleteProfileDialog } from '../../profiles/delete-profile-dialog'
import { RenameProfileDialog } from '../../profiles/rename-profile-dialog'
import { PROFILES_ROUTE } from '../../routes'

import { useProfilePrewarm } from './use-profile-prewarm'
import { useProfileRailRefreshOnActive } from './use-profile-rail-refresh-on-active'

const RAIL_GAP = 6 // px — matches gap-1.5 between tiles.

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

// Profiles remain directly reachable. Only the chevron opens the selected
// agent's details; browsing all conversations never hides the active identity.
export function ProfileRail() {
  const { t } = useI18n()
  const p = t.profiles
  const profiles = useStore($profiles)
  const scope = useStore($profileScope)
  const gatewayProfile = useStore($activeGatewayProfile)
  const swapTarget = useStore($gatewaySwapTarget)
  const order = useStore($profileOrder)
  const colors = useStore($profileColors)
  const states = useStore($profileBackendStates)
  const navigate = useNavigate()
  const [panelOpen, setPanelOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [pendingRename, setPendingRename] = useState<null | ProfileInfo>(null)
  const [pendingDelete, setPendingDelete] = useState<null | ProfileInfo>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const isAll = scope === ALL_PROFILES
  // Reflect the user's selection while its backend starts, without publishing
  // an active gateway identity before that connection is ready.
  const activeKey = normalizeProfileKey(swapTarget ?? gatewayProfile)
  const defaultProfile = profiles.find(profile => profile.is_default)
  const activeProfile = profiles.find(profile => normalizeProfileKey(profile.name) === activeKey) ?? defaultProfile

  const named = sortByProfileOrder(
    profiles.filter(profile => !profile.is_default),
    order
  )

  const stateOf = (profile: Pick<ProfileInfo, 'name'>): ProfileBackendState =>
    states[normalizeProfileKey(profile.name)] ?? 'asleep'

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
  }, [])

  // Keep a profile selected from another surface visible without scrolling the
  // surrounding session list. The rail stays the same at every profile count.
  useEffect(() => {
    const el = scrollRef.current
    const selected = el?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')

    if (!el || !selected) {
      return
    }

    const viewport = el.getBoundingClientRect()
    const tile = selected.getBoundingClientRect()

    if (tile.left < viewport.left) {
      el.scrollLeft -= viewport.left - tile.left
    } else if (tile.right > viewport.right) {
      el.scrollLeft += tile.right - viewport.right
    }
  }, [activeKey, profiles, order, panelOpen])

  const openCreate = () => {
    setPanelOpen(false)
    setCreateOpen(true)
  }

  const pick = (name: string) => {
    setPanelOpen(false)
    selectProfile(name)
  }

  const openManage = (name?: string) => {
    setPanelOpen(false)
    navigate(name ? `${PROFILES_ROUTE}?profile=${encodeURIComponent(name)}` : PROFILES_ROUTE)
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const lastOverRef = useRef<string | null>(null)

  const handleDragStart = ({ active }: DragStartEvent) => {
    lastOverRef.current = String(active.id)
    setPanelOpen(false)
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

  useProfileRailRefreshOnActive()
  const createRequest = useStore($profileCreateRequest)
  const lastCreateRef = useRef(createRequest)
  // eslint-disable-next-line no-restricted-syntax -- legitimate non-atom ref write
  useEffect(() => {
    if (createRequest === lastCreateRef.current) {
      return
    }

    lastCreateRef.current = createRequest
    setPanelOpen(false)
    setCreateOpen(true)
  }, [createRequest])

  return (
    <Popover onOpenChange={setPanelOpen} open={panelOpen}>
      <div aria-label={p.title} className="flex min-w-0 items-center gap-1.5" data-slot="profile-rail" role="group">
        {defaultProfile && (
          <ProfileTileButton
            active={activeKey === normalizeProfileKey(defaultProfile.name)}
            label={profileLabel(defaultProfile)}
            name={defaultProfile.name}
            onSelect={() => pick(defaultProfile.name)}
            state={stateOf(defaultProfile)}
            tipsEnabled={!panelOpen}
          />
        )}
        <div
          className="flex min-w-0 items-center gap-1.5 overflow-x-auto [overflow-anchor:none] [scrollbar-width:thin]"
          ref={scrollRef}
        >
          <DndContext
            collisionDetection={closestCenter}
            modifiers={[stepThroughCells]}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onDragStart={handleDragStart}
            sensors={sensors}
          >
            <SortableContext items={named.map(profile => profile.name)} strategy={horizontalListSortingStrategy}>
              <div className="relative flex items-center gap-1.5">
                {named.map(profile => (
                  <ProfileSquare
                    active={normalizeProfileKey(profile.name) === activeKey}
                    color={resolveProfileColor(profile.name, colors)}
                    key={profile.name}
                    label={profileLabel(profile)}
                    name={profile.name}
                    onDelete={() => {
                      setPanelOpen(false)
                      setPendingDelete(profile)
                    }}
                    onEditProfile={() => openManage(profile.name)}
                    onRecolor={color => setProfileColor(profile.name, color)}
                    onRename={() => {
                      setPanelOpen(false)
                      setPendingRename(profile)
                    }}
                    onSelect={() => pick(profile.name)}
                    state={stateOf(profile)}
                    tipsEnabled={!panelOpen}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
        <Tip label={p.newProfile}>
          <Button
            aria-label={p.newProfile}
            className="shrink-0"
            onClick={openCreate}
            size="icon-xs"
            type="button"
            variant="ghost"
          >
            <Codicon name="add" />
          </Button>
        </Tip>
        <div className="ml-auto flex shrink-0 items-center gap-1 border-l border-(--ui-stroke-tertiary) pl-2">
          <Tip label={p.manageProfiles}>
            <Button
              aria-label={p.manageProfiles}
              onClick={() => openManage()}
              size="icon-xs"
              type="button"
              variant="ghost"
            >
              <Codicon name="ellipsis" />
            </Button>
          </Tip>
          <PopoverTrigger asChild>
            <Button aria-label={p.agentPanel} disabled={!activeProfile} size="icon-xs" type="button" variant="ghost">
              <Codicon name={panelOpen ? 'chevron-up' : 'chevron-down'} />
            </Button>
          </PopoverTrigger>
        </div>
      </div>
      <PopoverContent
        align="end"
        aria-label={p.agentPanel}
        arrowPadding={6}
        className="w-64 max-w-(--radix-popover-content-available-width) p-0"
        collisionPadding={{ bottom: 44, left: 8, right: 8, top: 8 }}
        data-slot="profile-rail-panel"
        side="top"
        sideOffset={10}
      >
        {activeProfile && (
          <RailPanel
            activeProfile={activeProfile}
            isAll={isAll}
            multiProfile={profiles.length > 1}
            onEdit={() => openManage(activeProfile.name)}
            onScope={setShowAllProfiles}
            state={stateOf(activeProfile)}
          />
        )}
      </PopoverContent>
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
    </Popover>
  )
}

interface RailPanelProps {
  activeProfile: ProfileInfo
  isAll: boolean
  multiProfile: boolean
  onEdit: () => void
  onScope: (all: boolean) => void
  state: ProfileBackendState
}

function RailPanel({ activeProfile, isAll, multiProfile, onEdit, onScope, state }: RailPanelProps) {
  const { t } = useI18n()
  const p = t.profiles
  const scopeId = useId()

  return (
    <div className="flex flex-col gap-3 p-3 text-xs">
      <div className="flex items-center gap-3">
        <ProfileAvatar name={activeProfile.name} size={40} state={state} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-sm font-semibold text-foreground">{profileLabel(activeProfile)}</span>
          <span className="text-(--ui-text-secondary)">{p.railState[state]}</span>
          {activeProfile.model && (
            <span className="truncate text-(--ui-text-secondary)">{displayModelName(activeProfile.model)}</span>
          )}
        </div>
      </div>
      <div className="border-t border-(--ui-stroke-tertiary) pt-2">
        <Button className="w-full justify-start" onClick={onEdit} size="sm" type="button" variant="ghost">
          {p.editProfile}
        </Button>
      </div>
      {multiProfile && (
        <div className="flex items-center justify-between gap-3 border-t border-(--ui-stroke-tertiary) pt-3">
          <label className="min-w-0 text-(--ui-text-secondary)" htmlFor={scopeId}>
            {p.allConversations}
          </label>
          <Switch checked={isAll} id={scopeId} onCheckedChange={onScope} size="xs" />
        </div>
      )}
    </div>
  )
}

function ProfileAvatar({ name, size, state }: { name: string; size: number; state: ProfileBackendState }) {
  return (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ height: size, width: size }}>
      <ProfileFace mood={moodForBackendState(state)} name={name} size={size} />
      <ProfileStateDot className="bottom-0 right-0" state={state} />
    </span>
  )
}

/** The ring a tile wears while active: the bot's own color, so the ring and
 *  the face belong together. */
function useTileRingColor(name: string): string {
  const key = normalizeProfileKey(name)

  return useStoreSelector($profileLooks, looks => looks[key]?.appearance.color) ?? NEUTRAL_HUE
}

function ProfileTileButton({
  active,
  label,
  name,
  onSelect,
  state,
  tipsEnabled = true
}: {
  active: boolean
  label: string
  name: string
  onSelect: () => void
  state: ProfileBackendState
  tipsEnabled?: boolean
}) {
  const ringColor = useTileRingColor(name)

  return (
    <Tip label={tipsEnabled ? label : ''}>
      <Button
        aria-busy={state === 'waking'}
        aria-label={label}
        aria-pressed={active}
        className="shrink-0 [&_svg:not([class*='size-'])]:size-7"
        onClick={onSelect}
        size="icon"
        style={{ boxShadow: active ? `inset 0 0 0 1.5px ${ringColor}` : undefined }}
        type="button"
        variant="ghost"
      >
        <ProfileAvatar name={name} size={28} state={state} />
      </Button>
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
  onEditProfile: () => void
  onDelete: () => void
  state: ProfileBackendState
  /** False while the agent panel is open. */
  tipsEnabled?: boolean
}

// Hold this long without moving (a drag would have started first) to open the
// color picker — the "hard press" gesture, distinct from tap-to-select.
const LONG_PRESS_MS = 450

// Each profile keeps its bot face, state dot, and an inset selection ring.
// Drag-sort to reorder (a tap below the drag threshold still selects), and
// right-click for profile actions. The button carries both the
// tooltip and context-menu triggers via nested asChild Slots, so a single
// element keeps the dnd listeners, hover tip, and right-click menu.
function ProfileSquare({
  active,
  color,
  label,
  name,
  onDelete,
  onEditProfile,
  onRecolor,
  onRename,
  onSelect,
  state,
  tipsEnabled = true
}: ProfileSquareProps) {
  const { t } = useI18n()
  const p = t.profiles
  const hue = useTileRingColor(name)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [tipOpen, setTipOpen] = useState(false)
  const pressTimer = useRef<null | number>(null)
  const suppressClick = useRef(false)
  // Hovering a tile telegraphs the switch — start that profile's backend
  // spawn now so a cold click doesn't pay the full boot.
  const { cancelPrewarm, startPrewarm } = useProfilePrewarm(name)

  const { attributes, isDragging, listeners, setNodeRef, transform, transition } = useSortable({
    id: name,
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
  const ring = active ? `inset 0 0 0 1.5px ${hue}` : ''
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
          <Tooltip onOpenChange={setTipOpen} open={tipsEnabled && tipOpen}>
            <PopoverAnchor asChild>
              <ContextMenuTrigger asChild>
                <TooltipTrigger asChild>
                  <button
                    className={cn(
                      'relative grid size-9 shrink-0 cursor-grab touch-none select-none place-items-center rounded-(--control-radius) outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      'hover:bg-(--ui-control-hover-background)',
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
                    aria-busy={state === 'waking'}
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
                    <ProfileAvatar name={name} size={28} state={state} />
                  </button>
                </TooltipTrigger>
              </ContextMenuTrigger>
            </PopoverAnchor>
            <TooltipContent>{label}</TooltipContent>
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
          <ContextMenuItem onSelect={onEditProfile}>
            <Codicon name="edit" size="0.875rem" />
            <span>{p.editProfile}</span>
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => void runExportProfileFlow(name)}>
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
