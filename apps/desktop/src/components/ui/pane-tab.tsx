import * as React from 'react'

import { type MenuKit, renderActionItem } from '@/components/ui/actions-menu'
import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { Tip } from '@/components/ui/tooltip'
import { translateNow } from '@/i18n'
import { isMetaClose, middleClickHandlers } from '@/lib/middle-click'
import { cn } from '@/lib/utils'

/** Inset stroke for a vertical tab rail — content-facing edge. */
export const PANE_TAB_STRIP_LINE_LEFT = 'shadow-[inset_1px_0_0_var(--ui-stroke-tertiary)]'
export const PANE_TAB_STRIP_LINE_RIGHT = 'shadow-[inset_-1px_0_0_var(--ui-stroke-tertiary)]'

// `--tab-face` is the tab's EFFECTIVE surface color — what actually sits under
// the label after every wash lands. Idle hover repaints it below with the same
// color-mix the darkening wash applies.
const TAB =
  'group/tab relative flex shrink-0 items-center border-transparent bg-(--tab-bg) text-xs font-medium [-webkit-app-region:no-drag] [--tab-face:var(--tab-bg)]'

// Horizontal tabs are CHIPS: a rounded bubble centered in a taller strip, so the
// label, the status lead and a real-size ✕ all sit inside one visible shape.
const TAB_CHIP = 'h-7 min-w-0 max-w-56 self-center rounded-lg border'

// Vertical rails keep the compact editor-tab form (no room for a chip).
const TAB_VERTICAL =
  'w-full max-h-48 justify-center not-first:border-t not-first:border-t-(--ui-stroke-quaternary) [writing-mode:vertical-rl]'

// The active chip: a filled bubble with a hairline and a soft lift. The fill is
// the surface below nudged toward the foreground, so it reads in light and dark.
const TAB_CHIP_ACTIVE =
  'text-foreground border-(--ui-stroke-secondary) shadow-xs [--tab-bg:color-mix(in_srgb,var(--foreground)_8%,var(--pane-tab-active-bg,var(--ui-editor-surface-background)))]'

const TAB_VERTICAL_ACTIVE =
  'h-full text-foreground [--tab-bg:var(--pane-tab-active-bg,var(--ui-editor-surface-background))]'

// Inactive = gutter, defaulting to the shared chrome surface so a strip that
// sets no vars still matches the sidebar/titlebar instead of falling through to
// the raw (unmixed) card seed. Hover DARKENS: surfaces this close in value need
// a darkening wash to register at all.
const TAB_IDLE =
  'text-(--ui-text-secondary) [--tab-bg:var(--pane-tab-strip-bg,var(--ui-sidebar-surface-background))] hover:shadow-[inset_0_0_0_100vmax_color-mix(in_srgb,#000_var(--ui-tab-hover-darken),transparent)] hover:[--tab-face:color-mix(in_srgb,#000_var(--ui-tab-hover-darken),var(--tab-bg))] hover:text-foreground'

// Standing chrome (Sessions / Workbots): a SEGMENT inside a rounded control, the
// way a view switcher reads — never a closeable tab.
const TAB_SEGMENT = 'h-6 min-w-0 flex-1 justify-center rounded-lg border px-3'

const TAB_SEGMENT_ACTIVE =
  'text-foreground border-(--ui-stroke-secondary) shadow-xs [--tab-bg:var(--pane-tab-active-bg,var(--ui-editor-surface-background))]'

const TAB_SEGMENT_IDLE = 'text-(--ui-text-tertiary) [--tab-bg:transparent] hover:text-foreground'

// A tab riding a multi-tab selection: an accent wash over whatever surface the
// tab sits on. A background-image gradient (not a shadow) so it stacks cleanly
// over `--tab-bg` without fighting the hover shadows.
const TAB_SELECTED =
  '[background-image:linear-gradient(color-mix(in_srgb,var(--ui-accent)_14%,transparent),color-mix(in_srgb,var(--ui-accent)_14%,transparent))] [--tab-face:color-mix(in_srgb,var(--ui-accent)_14%,var(--tab-bg))] text-foreground'

interface PaneTabProps extends React.ComponentProps<'div'> {
  active?: boolean
  dirty?: boolean
  /** When a closeable chip shows its ✕: `always` (default — a standing target,
   *  so nothing about closing depends on hovering) or `hover` (reserved space,
   *  revealed on hover/focus — for a tab whose close is a rarer, heavier act). */
  closeButton?: 'always' | 'hover'
  /** Close verb. Horizontal chips carry an in-flow ✕ on the right; middle-click
   *  and ⌘-click always work, and stay the only gestures on vertical rails (no
   *  room for a chip ✕). */
  onClose?: () => void
  /** Part of a multi-tab selection (⌥/Ctrl-click, Shift-click) — an accent
   *  wash marks every tab that a drag would carry, Chrome-style. */
  selected?: boolean
  /** Whether a closeable horizontal tab renders the ✕. */
  showCloseButton?: boolean
  /** `chip` (default) or `segment` — standing chrome that is shown/hidden, never
   *  closed, rendered as one option of a switcher (see `PaneTabSegments`). */
  variant?: 'chip' | 'segment'
  /** Vertical rail form (collapsed sidebar zones). */
  vertical?: boolean
  /** Content-facing edge of a vertical rail — the strip line the active tab cuts. */
  side?: 'left' | 'right'
}

/**
 * Editor tab shell — preview rail + zone headers + collapsed vertical rails.
 *
 * Defaults need no vars: the active tab takes the editor surface, inactive the
 * sidebar one. Override `--pane-tab-active-bg` to change what the active tab
 * merges into, `--pane-tab-strip-bg` for a gutter unlike the bar around it.
 */
export const PaneTab = React.forwardRef<HTMLDivElement, PaneTabProps>(function PaneTab(
  {
    active = false,
    closeButton = 'always',
    dirty = false,
    onClose,
    onMouseDown,
    onPointerDown,
    onPointerUp,
    onClickCapture,
    selected = false,
    showCloseButton = true,
    variant = 'chip',
    vertical = false,
    side = 'left',
    children,
    className,
    ...props
  },
  ref
) {
  // Vertical rails only. Horizontal tabs draw no bottom border — the strip owns
  // that rule, and a per-tab border stacked a second translucent line over it.
  const edge = vertical ? (side === 'right' ? 'border-l' : 'border-r') : undefined
  const middle = middleClickHandlers(onClose)
  const segment = variant === 'segment' && !vertical

  return (
    <div
      className={cn(
        TAB,
        vertical ? TAB_VERTICAL : segment ? TAB_SEGMENT : TAB_CHIP,
        edge,
        vertical
          ? active
            ? TAB_VERTICAL_ACTIVE
            : cn(TAB_IDLE, edge && `${edge}-(--ui-stroke-tertiary)`)
          : segment
            ? active
              ? TAB_SEGMENT_ACTIVE
              : TAB_SEGMENT_IDLE
            : active
              ? TAB_CHIP_ACTIVE
              : TAB_IDLE,
        selected && TAB_SELECTED,
        className
      )}
      data-active={active}
      data-selected={selected || undefined}
      data-vertical={vertical || undefined}
      onClickCapture={event => {
        // Sites whose tab activates on the label's own onClick (the preview
        // rail) fire it AFTER our pointerdown close — swallow that stray click
        // in the capture phase so it can't re-select the just-closed tab.
        if (onClose && isMetaClose(event)) {
          event.preventDefault()
          event.stopPropagation()
        }

        onClickCapture?.(event)
      }}
      onMouseDown={event => {
        middle.onMouseDown(event)
        onMouseDown?.(event)
      }}
      onPointerDown={event => {
        middle.onPointerDown(event)

        // ⌘-click closes. Preempt here — the tab strips activate/drag on
        // pointerdown (drag-session onTap), so we must claim the press before
        // the shell's own handler starts a drag, and skip it entirely.
        if (onClose && isMetaClose(event)) {
          event.preventDefault()
          event.stopPropagation()
          onClose()

          return
        }

        onPointerDown?.(event)
      }}
      onPointerUp={event => {
        middle.onPointerUp(event)
        onPointerUp?.(event)
      }}
      ref={ref}
      {...props}
    >
      {children}
      {dirty && (
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute grid size-4 place-items-center',
            vertical ? 'bottom-1.5 left-1/2 -translate-x-1/2' : 'right-1.5 top-1/2 -translate-y-1/2'
          )}
        >
          <span className="size-2 rounded-full bg-amber-500 shadow-[0_0_0_2px_var(--tab-bg),0_1px_2px_rgba(0,0,0,0.45)] dark:bg-amber-400" />
        </span>
      )}
      {onClose && showCloseButton && !vertical && !segment && (
        // In-flow ✕: part of the chip, so the label truncates before it instead
        // of fading under an overlay, and the tab width never jumps on hover. A
        // 24px target (the chip is 28px tall) the pointer can find without
        // aiming; `hover` mode only dims it, it stays focusable and in layout.
        <button
          aria-label={translateNow('common.close')}
          className={cn(
            'mr-1 grid size-6 shrink-0 cursor-pointer place-items-center rounded-md text-(--ui-text-tertiary) outline-none transition-opacity hover:bg-(--ui-control-hover-background) hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/35',
            closeButton === 'hover' && 'opacity-0 group-hover/tab:opacity-100 focus-visible:opacity-100'
          )}
          onClick={event => {
            event.preventDefault()
            event.stopPropagation()
            onClose()
          }}
          onPointerDown={event => {
            // Claim a plain left press so the shell can't also activate or
            // drag the tab. Middle/⌘ presses bubble on purpose — the tab's
            // own close gestures already route them.
            if (event.button === 0 && !isMetaClose(event)) {
              event.stopPropagation()
            }
          }}
          type="button"
        >
          <Codicon name="close" size="0.75rem" />
        </button>
      )}
    </div>
  )
})

interface PaneTabLabelProps extends React.ComponentProps<'button'> {
  /** `button` when the label is the activation target (preview rail);
   *  default `span` defers to the shell (zone drag/activate). */
  as?: 'button' | 'span'
}

/** Truncating label inside a `PaneTab`. `className` merges into the text span
 *  (e.g. `normal-case tracking-normal` for filenames). */
export const PaneTabLabel = React.forwardRef<HTMLElement, PaneTabLabelProps>(function PaneTabLabel(
  { as = 'span', className, children, ...props },
  ref
) {
  const Comp = as as React.ElementType

  return (
    <Comp
      className="flex h-full min-w-0 max-w-full items-center overflow-hidden px-2 text-left outline-none group-data-[vertical]/tab:h-auto group-data-[vertical]/tab:w-full group-data-[vertical]/tab:justify-center group-data-[vertical]/tab:py-2"
      ref={ref}
      {...props}
    >
      <span
        className={cn(
          'block min-w-0 truncate text-xs font-medium group-data-[vertical]/tab:text-[9px] group-data-[vertical]/tab:tracking-wide group-data-[vertical]/tab:uppercase',
          className
        )}
      >
        {children}
      </span>
    </Comp>
  )
})

interface PaneTabSegmentsProps extends React.ComponentProps<'div'> {
  /** Stretch to the strip's width (a strip holding only segments). */
  fill?: boolean
}

/** The rounded switcher that holds consecutive `variant="segment"` tabs. */
export function PaneTabSegments({ children, className, fill = false, ...props }: PaneTabSegmentsProps) {
  return (
    <div
      className={cn(
        'flex min-w-0 items-center gap-0.5 self-center rounded-xl border border-(--ui-stroke-secondary) bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] p-0.5',
        fill ? 'flex-1' : 'shrink-0',
        className
      )}
      role="presentation"
      {...props}
    >
      {children}
    </div>
  )
}

interface PaneTabStripProps extends React.ComponentProps<'div'> {
  /** The scrolling tab list — receives `role="tablist"`. */
  children: React.ReactNode
  /** Ref on the scroller itself, for `useActiveTabVisible`. */
  listRef?: React.Ref<HTMLDivElement>
  /** Non-scrolling trailing chrome pinned to the right (the minimize chevron). */
  trailing?: React.ReactNode
}

/**
 * The horizontal tab bar every strip in the app sits in. Owns the bar's height
 * and surface, the scroll behaviour (hidden scrollbars, contained overscroll),
 * and the pinned trailing slot — so a new strip inherits all of it instead of
 * re-deriving the geometry and drifting out of alignment.
 *
 * Tabs go in `children` as `PaneTab`s; per-strip extras (drag handlers,
 * `data-zone-tabstrip`, drop carets) ride on the usual div props.
 */
export const PaneTabStrip = React.forwardRef<HTMLDivElement, PaneTabStripProps>(function PaneTabStrip(
  { children, className, listRef, trailing, ...props },
  ref
) {
  return (
    <div
      // Default strip sits on the rail. The main chat zone overrides both
      // fills to the stage so tabs belong to the palco, not the sidebar.
      className={cn(
        'group/pane-header relative flex h-9 shrink-0 select-none bg-(--ui-sidebar-surface-background) [-webkit-app-region:no-drag] [--pane-tab-active-bg:var(--ui-sidebar-surface-background)]',
        className
      )}
      ref={ref}
      {...props}
    >
      <div
        className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto overflow-y-hidden overscroll-x-contain px-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        ref={listRef}
        role="tablist"
      >
        {children}
      </div>
      {trailing}
    </div>
  )
})

/** A glyph button on a tab strip: the "+" and anything a pane contributes (a
 *  preview's console / DevTools). Callers pass DATA, never classes — the same
 *  contract as `TitlebarTool`, so every glyph on every strip matches. */
export interface PaneStripTool {
  active?: boolean
  disabled?: boolean
  icon: React.ReactNode
  id: string
  /** Tooltip text and accessible name. */
  label: string
  onSelect: () => void
  /** A primary affordance (the chat strip's "+"): a 28px target at full
   *  strength instead of the dimmed 24px glyph. */
  prominent?: boolean
}

/**
 * Renders one `PaneStripTool` through the app's `Button` + `Tip` primitives, the
 * way `TitlebarToolButton` does: ghost variant, no active background — state
 * reads from the glyph's own opacity, with `aria-pressed` carrying it for a11y.
 *
 * Pointerdown is claimed here so a click can never also activate or drag the
 * zone behind the strip.
 */
export function PaneStripGlyph({ active, disabled, icon, label, onSelect, prominent }: Omit<PaneStripTool, 'id'>) {
  return (
    <Tip label={label}>
      <Button
        aria-label={label}
        aria-pressed={active ?? undefined}
        className={cn(
          'self-center bg-transparent select-none',
          prominent && 'size-7',
          active || prominent ? 'opacity-100' : 'opacity-60 hover:opacity-100'
        )}
        disabled={disabled}
        onClick={onSelect}
        onPointerDown={event => event.stopPropagation()}
        size="icon-xs"
        type="button"
        variant="ghost"
      >
        {icon}
      </Button>
    </Tip>
  )
}

/** Close-verb enablement for `paneTabCloseItems` — how many tabs each verb hits. */
export interface PaneTabCloseCounts {
  all: number
  others: number
  right: number
}

interface PaneTabCloseItemsOptions {
  counts: PaneTabCloseCounts
  /** Omit to hide Close entirely (an uncloseable tab shows no dead action). */
  onClose?: () => void
  onCloseAll: () => void
  onCloseOthers: () => void
  onCloseToRight: () => void
}

/**
 * The four close verbs every tab menu offers — Close / others / to the right /
 * all — so a tab answers a right-click the same way wherever it lives. No ⌘W
 * hint on Close: the keybind closes the FOCUSED zone's active tab, so it would
 * be a lie on the inactive tab the user actually right-clicked.
 */
export function paneTabCloseItems(
  kit: MenuKit,
  { counts, onClose, onCloseAll, onCloseOthers, onCloseToRight }: PaneTabCloseItemsOptions
) {
  return (
    <>
      {onClose &&
        renderActionItem(kit, {
          icon: 'close',
          label: translateNow('common.close'),
          onSelect: onClose
        })}
      {renderActionItem(kit, {
        disabled: !counts.others,
        icon: 'close-all',
        label: translateNow('zones.closeOthers'),
        onSelect: onCloseOthers
      })}
      {renderActionItem(kit, {
        disabled: !counts.right,
        icon: 'arrow-right',
        label: translateNow('zones.closeToRight'),
        onSelect: onCloseToRight
      })}
      {renderActionItem(kit, {
        disabled: !counts.all,
        icon: 'clear-all',
        label: translateNow('zones.closeAll'),
        onSelect: onCloseAll
      })}
    </>
  )
}
