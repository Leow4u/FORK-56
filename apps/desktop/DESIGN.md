# Desktop Design System

Conventions for the Electron desktop app (`apps/desktop`). Read this before
adding a component, overlay, or style. The rule of thumb: **one source per
concern, tokens over literals, flat over boxed.** If you reach for a raw color,
a one-off shadow, a bespoke button, or a hardcoded `px-*` on a control — stop,
there's already a primitive for it.

This file owns the visual and interaction contract. Read
[`AGENTS.md`](./AGENTS.md) for architecture, state, resolver, transport, and
testing rules.

This doc contains two kinds of content, maintained differently:

- **Principles** (flatness, intent, feedback, motion, cancellation) are durable.
  They hold as components come and go.
- **Named contracts** (tokens, `Button` variants, primitive names) are the
  design system's current API. They are maintained *with* the code: if you
  change a primitive, token, or variant, update its entry here **in the same
  change** — a stale name in this file is a bug, exactly like a stale type.

When a rule and the code disagree, fix whichever is wrong rather than forking a
one-off at the call site.

## Principles

1. **Flat, not boxed.** No card-in-card, no divider borders inside a panel.
   Group with whitespace and a single hairline, never nested rounded boxes.
2. **Borderless elevation for floating panels.** Overlays float on
   `shadow-work4you` + a `--stroke-work4you` hairline, not thick framed boxes. In-panel
   structure may use token hairlines sparingly.
3. **One primitive per concern.** One `Button`, one set of control variants,
   one `SearchField`, one `Loader`, one `ErrorState`. Migrate onto them; don't
   fork.
4. **Tokens, not literals.** Reference CSS vars (`--ui-*`, `--shadow-work4you`,
   `--theme-*`), never raw hex / ad-hoc rgba in components.
5. **Style lives in the primitive.** Variants and sizes own padding, radius,
   color, chrome. Call sites pass a `variant`/`size`, not `className` overrides
   that re-specify those.
6. **Intent before automation.** Surface useful actions and previews, but do not
   open panes, move focus, or navigate because a tool happened to produce
   something.
7. **Immediate feedback.** Direct manipulation updates the view first. Network
   or disk persistence reconciles afterward and rolls back visibly on failure.

## Information architecture

- **Chat is the home surface.** The transcript and composer stay primary; tools,
  previews, files, review, and terminal complement the conversation.
- **Pages are durable destinations.** Chat, Skills, Messaging, and Artifacts
  remain in shell chrome. Do not hide a distinct product noun inside an
  unrelated page.
- **Route overlays are short tasks.** Settings, Command Center, Cron, Profiles,
  Agents, and Starmap render as `OverlayView` cards and return to the previous
  route on close. Model/session pickers and dialogs layer above the current
  surface; they are not navigation stacks.
- **Panes are working context.** Preview, files, review, and terminal remain
  attached to the current task. Their state survives temporary hiding and chat
  switches where the underlying tool is meant to persist.
- **One action, one home.** A command may have keyboard, palette, and visible
  affordances, but they invoke the same action and state. Do not fork behavior
  per entry point.
- **Projects own workspace cwd.** Use Sidebar → Projects for local folders and
  worktrees; do not reintroduce a per-session/right-sidebar folder-picker flow.

Navigation must preserve context. A background session finishing, a tool result
arriving, or a project refresh may update badges and cached data; it must not
replace the foreground transcript or steal focus.

## Surfaces & elevation

Floating panels (base `Dialog`, route overlays, boot/install/update surfaces,
model-picker, onboarding, prompt overlays, notifications) use:

```
shadow-work4you           /* downward-weighted, layered contact→ambient falloff */
border-(--stroke-work4you) /* currentColor hairline, theme-adaptive */
```

Both are CSS vars in `src/styles.css` — tune in one place, everything inherits.
Don't add per-overlay `shadow-[…]` or `border-(--ui-stroke-secondary)`
one-offs; if elevation needs to change, change the token.

Menus and popovers use their own shared `shadow-md` +
`--ui-stroke-secondary` primitive treatment. Drag affordances may use tokenized
dashed targets and local blur. These are semantic surface classes, not licenses
for call-site shadow or border inventions.

## Stroke & color tokens

| Token | Use |
| --- | --- |
| `--ui-stroke-primary…quaternary` | hairlines, in descending strength |
| `--ui-stroke-tertiary` | the default in-panel divider / list hairline — and every bordered surface in the transcript |
| `--stroke-work4you` | the overlay hairline (pairs with `shadow-work4you`) |
| `--ui-text-primary / -secondary / -tertiary / -quaternary` | text hierarchy; in light mode tertiary and quaternary sit on the 4.5:1 readability floor |
| `--dt-input-border` | resting border strength of input fields (% of the ring color); hover doubles it, focus goes full |
| `--conversation-scaffold-text / -meta` | transcript activity lines (thinking headers, tool rows, run summaries, the live status line) and their durations/counts. The root value is the lifted ink; a `data-conversation-scaffold` surface rests both on the 4.5:1 floor and lifts them on hover/keyboard focus. The step is a token, never an opacity fade — opacity compounded under the floor and dimmed error rows with it |
| `--disclosure-caret-rest` | resting opacity of a disclosure caret. Never 0: a row that opens says so before the pointer finds it; hover and an open row go full |
| `--ui-bg-quaternary` | soft control fill (secondary button) |
| `--ui-widget-surface-background` | fill for inline chat widgets (`WIDGET_SHELL_CLASS`) |
| `--chrome-action-hover` | hover fill for quiet controls |
| `--theme-primary`, `--ui-accent` | brand/accent |

Never hardcode `border-gray-*`, `bg-white`, `text-black`, etc. `BrandMark` uses
the PNG's own alpha — do not put a white (or any) tile behind it.

Readable grey text uses `text-muted-foreground` or a `--ui-text-*` token at
full strength. Don't stack an alpha on top (`text-muted-foreground/75`): the
tokens are already tuned to the readability floor, and an extra alpha drops
the text below it. Alpha steps are fine on decorative glyphs and on controls
that are revealed on hover.

## Radius tokens

Chrome (sidebars, menus, popovers, dialogs) follows `--radius-scalar`, which
keeps its corners tight: `rounded-md` / `rounded-xl` resolve to 2–3px there.
Four radii sit outside the scalar on purpose and are used through their token,
never a Tailwind `rounded-*` step:

| Token | Use |
| --- | --- |
| `--control-radius` (6px) | every `Button` size and variant except `chip`, every `controlVariants` control (Input, Textarea, SelectTrigger), the `SegmentedControl` track (its pill is the token minus the 2px track padding) |
| `--card-radius` (12px) | grouped settings cards (`SettingsGroup`, the model list, billing cards) |
| `--composer-radius` | the prompt card |
| `--prompt-bubble-radius` (16px) | a sent prompt's bubble |

## Buttons — one component

`src/components/ui/button.tsx` is the single source. Pick a `variant` + `size`;
do **not** pass `h-*`, `px-*`, `py-*`, or icon-size overrides.

**Variants:** `default` (primary), `destructive`, `secondary` (soft fill —
the default non-primary look), `outline` (transparent + 1px inset ring, no
fill/shadow), `ghost`, `link`, `text` (boxless quiet inline — "Cancel",
"Clear"), `textStrong` (bold underlined inline affordance — "Change",
"Open logs"), `chip` (pill bubble — `--ui-chat-bubble-background` fill +
`--ui-stroke-tertiary` hairline; labeled actions and circular icon chips).

**Sizes:** `default`, `xs`, `sm`, `lg`, `inline` (flush, zero box — for buttons
that sit inside a heading/sentence; replaces `h-auto px-0 py-0`), `micro`
(status-stack/table-footers), and the icon family `icon` / `icon-xs` /
`icon-sm` / `icon-lg` / `icon-titlebar`.

**Tooltips only when hover teaches something new.** `<Tip>` is for discovery,
not a tax on every icon. Ask: does hover reveal something the user cannot
already see or infer? If not, skip the tip; keep an `aria-label` for a11y.

Tip unlabeled chrome when the job (or a keybind / truncated path / host /
other detail) is not already on screen — toolbar / titlebar / statusbar icons,
`TipKeybindLabel` shortcuts, ownership chips, unlabeled icon grids.

Do **not** tip:

- Menu triggers (kebabs / ⋯ / `ActionsMenu` / `DropdownMenuTrigger`) — the
  affordance is "open menu"; verbs live in the menu. Never tip
  `"Actions for ${row title}"` / `"Project actions"` / `"Actions"`.
- Close / dismiss X buttons — the glyph is the label (`aria-label` only).
- Controls whose visible label already says what the tip would ("click to…",
  paraphrases of the same words, timer labels restating "Running").

Never use native HTML `title=` on buttons — unstyled, ~500ms OS delay, clashes
with the themed `Tip`. `src/components/ui/__tests__/no-native-title.test.ts`
fails on any `<button>` / `<Button>` that still carries `title=`.

**Keybind hints in tooltips.** On a tipped button bound to a rebindable hotkey,
use `<TipKeybindLabel actionId="..." />` — it reads the i18n label and the
current combo from `$bindings`. Pass `text={...}` only when the label is
context-dependent (e.g. "Show" / "Hide"). Never hardcode combos; always use
`useKeybindHint` or `TipKeybindLabel`.

Notes:
- Buttons are sized by padding + line-height (no fixed heights). Text and icon
  buttons share `--control-radius`. `chip` is the exception: it is always a
  pill (`rounded-full`), including `icon-*` sizes.
- SVGs inherit `size-3.5` (`size-3` at `xs`). Don't re-set icon size.
- Polymorph with `asChild` when the button must render as a link/Slot.

## Form controls

- **`controlVariants`** (`src/components/ui/control.ts`) is the shared shape for
  `Input` / `Textarea` / `SelectTrigger`. New text-entry controls compose it.
  `shape="pill"` is the rounded field (the Browser's address bar) — the same
  shape `SearchField`'s pill draws; reach for it instead of a radius override.
- **`SearchField`** — the only search input. Default is borderless,
  underline-on-focus, auto-width. `shape="pill"` is that same field with the
  rounded hairline (artifacts library header). Don't wrap it in another
  bordered tile. Empty lists hide their search field.
- **`SegmentedControl`** — the choice control for small mutually-exclusive sets
  (color mode, tool-call display, usage period). Replaces radio piles and
  pill rows.
- **`Switch`** (`size="xs"`) — bare, with `aria-label`. No bordered text wrapper.
- **`ColorSwatches`** — `presentation="compact"` keeps the small swatch grid;
  `presentation="palette"` groups five columns with larger hit targets, a
  checked selection and a labeled automatic-color action. Profile and agent
  creation use the palette presentation.

## Tab strips

- **`PaneTabStrip` + `PaneTab`** (`src/components/ui/pane-tab.tsx`) draw every
  strip; its `variant` reaches every tab and label in it. `underline` (default):
  tabs merge into the bar, the active one carries the accent underline, the ✕
  appears on hover and titles are set in small uppercase. `surface`: each tab is a rounded
  chip with a fixed 200px width, a soft `--ui-bg-quaternary` active fill,
  the ✕ always shown in a slot of its own and ellipsized titles in their own
  case. Chat and content zones share this variant and its existing 11px label
  typography. Horizontal strips are 40px tall; collapsed vertical rails remain
  28px wide. The strip background continues the pane surface; the chat stage
  retains `MAIN_STAGE_TAB_STRIP_CLASS` so its header matches the chat body.

## Layout

- **Gutters:** `PAGE_INSET_X` (`src/app/layout-constants.ts`) for page side
  padding; `PAGE_INSET_NEG_X` to bleed a child to the edge. Don't hardcode
  `px-6`/`px-8` on pages. Settings bodies also cap at `PAGE_SETTINGS_MAX_W`
  so the column stays centered, with 247px of stage free on each side
  when the pane is wide enough — not a full-stage fill. Chat
  transcript and composer use `--composer-width` (48rem; narrow panes still
  `min(..., 100% - 2rem)`). Empty intro centers the prompt card on the
  pane midline and rests the headline just above it; a live thread docks
  the composer at the bottom. HUD keeps `--composer-width: 100%`.
- **Master/detail overlays:** `OverlaySplitLayout` + `OverlaySidebar` /
  `OverlayMain`. Cron, profiles, etc. ride this — don't rebuild a titlebar
  shell. Settings passes `header` (search pill) and `itemTone="quiet"` into
  `OverlayNav`; other overlays keep the default boxed active item.
- **Rows:** `ListRow` (settings `primitives.tsx`) for label/description/action
  rows. Flat, flush-left; no per-row indentation that fights flush headers.
  The control stays on the title line at every width. `wide` rows are the
  exception: the action sits under the label so a full-width field can wrap.
- **Settings groups:** OverlayMain uses the same stage token as chat
  (`--ui-chat-surface-background`). `SettingsGroup` is spacing + an optional
  label on that stage, not a contrasting well. Don't invent a fill well.
  `SectionHeading variant="page"` is the page H1; `variant="group"` is the
  quiet label above a group. `variant="section"` is the legacy icon+label
  heading.
- **No dividers between rows** unless the list genuinely needs them; prefer
  spacing. When you do need one, it's a single `--ui-stroke-tertiary` hairline.

## Feedback & empty/error/loading states

- **Loading:** `Loader` (`src/components/ui/loader.tsx`) — animated math/ascii
  curves (`orbit-ring` for page loads, `lemniscate-bloom` for long ops). Never
  ship the literal text "Loading…".
- **Errors:** `ErrorState` + the canonical `ErrorIcon` (no bg chip). One look
  for the React boundary, in-dialog errors, and the boot-failure banner. Pass
  nodes for title/description so Radix `DialogTitle`/`Description` can flow
  through for a11y.
- **Logs:** `LogView` — no bg, hairline border, tight padding, small mono.
  Every place we surface raw logs uses it.
- **Empty:** `EmptyState` for plain page bodies; `PanelEmpty` for overlay
  master/detail empties with an icon and action. Don't hand-roll a third
  centered empty.

## Chat, tools & boot surfaces

- The transcript and composer are built on `@assistant-ui/react`. Extend the
  existing components under `src/components/assistant-ui` and
  `src/app/chat/composer`; do not fork a second markdown, message, tool-call, or
  approval renderer for one feature.
- **Activity lines** — thinking headers, tool rows, run summaries and the live
  status line render through `ScaffoldRow` and read on
  `--conversation-scaffold-*`, at or above the 4.5:1 floor at rest. Their
  words come from the catalog (`assistant.tool.runSummary`, `titles`), never a
  literal. Every file a turn wrote keeps its row, diff or not; a silent call
  (a todo update, a reaction) is never counted in a summary or ticked live.
- **Activity density** — `$activityDensity` (Compact, the default / Balanced /
  Detailed) decides how much of a turn's work the transcript shows; Detailed
  shows every thought and call as it happens, without exception. In Compact
  and Balanced a live turn is one block (`LiveTurn`) hosted by the turn's
  first assistant message, and the two read the same while it runs. What the
  agent says to the user along the way is prose, whole and in order — never
  clipped, never folded into a list. Under each sentence, one line sums up
  the work that came after it ("Created index.html", "Opened preview, used
  the preview 3 times") and opens into its rows; that line sits close under
  its sentence and steps in. Cards (questions, images, delegations) sit
  where they happened, the reply comes last, and one status line closes the
  block: the call in flight, else the model's reasoning heading, else
  "Thinking", with the plan's step and the turn clock. The call in flight and
  the thought still arriving belong to the status line, not to a row.
  `segmentTurn` (`src/lib/turn-timeline.ts`) is the one place that splits a
  turn this way, and sentences keep their part's key, so the text before a
  call stays on screen when the call arrives instead of jumping or vanishing.
- **Settled turn** — one line that says what the turn did, in the run-summary
  words ("Explored 8 files, ran 3 commands, created resumo.md"), with the
  duration as meta and failed steps counted on it; a turn with no calls says
  "Worked for …". Closed, only the cards and the reply stay out. Opened, it
  reads the way it ran — the same stream as the live block; a turn that said
  nothing along the way opens straight into its rows. At Balanced the newest
  turn stays open until the next message — only earlier turns fold on their
  own; Compact folds it as soon as it ends. A write whose diff starts from
  nothing reads "created", and every file row carries +N −M after a reload
  too (the diff is kept as display metadata on its tool row).
- **Status words** — while the model writes a call out, before it has a
  target, the status line uses the row's own words ("Writing file", "Running
  command"), never a bare category verb. A whole-file write reads "Writing
  index.html" while it runs.
- **Prompt bubble** — a sent prompt sits at the end of the line (the right,
  or the left when the UI runs right to left), as wide as its text and at
  most 80% of the column, filled with `--dt-user-bubble` and no border: the
  fill is what sets it apart from the reply, which reads as prose across the
  column. The fill is the theme's bubble seed at full strength, lifted toward
  the ink in dark mode (`--theme-bubble-lift`). The prompt is shown in full,
  never clamped, and scrolls with the conversation; the timeline rail is the
  way back to it. Its text is text, not a button — a click selects. One line
  under it holds its reactions, always shown, and its actions — Copy, Edit,
  and Restore, or Stop while its turn runs — shown on hover or keyboard focus
  (always on a touch screen), keeping their height while hidden. Edit opens
  the inline editor at full width. Attachments sit just above the bubble, at
  the same end of the line: images as thumbnails 8rem tall, in a row that
  wraps from that end. Process and agent-to-agent notices stay centered
  notices, never bubbles.
- **Reply actions** — one row under a reply, where the reply starts: its
  versions when there is more than one, then Branch in new chat, Copy, Read
  aloud, Refresh and React, then how long the turn took. The newest settled
  reply keeps the row on screen; older replies show it on hover or keyboard
  focus, and it keeps its height while hidden.
- **Turn rhythm** — a prompt sits closer to its own reply than to the reply
  before it, so each exchange reads as one piece: about 34px from a prompt's
  bubble to its reply, 54px from a reply's last line to the next prompt.
  Turn rows are spaced by `--conversation-pair-gap`; inside a turn, blocks
  keep `--conversation-turn-gap`. The HUD sets the pair gap back to the turn
  gap, since there the air is most of the band.
- **Changed files** — the newest settled turn that edited files ends with
  one card, under the reply and above its actions (`changed-files-card.tsx`):
  a `--ui-stroke-tertiary` hairline at `--card-radius`, no fill, lined up
  with the reply's text and at its type size. It labels the files edited in
  that response; its counts come from tool edits, not a Git snapshot of the
  turn. "View current changes" opens the repository's current uncommitted
  changes. File rows open the corresponding current diff; a file no longer
  changed gets an explicit explanation. Counts show both sides at zero too.
- **Composer context** — the empty-chat workspace picker stays below the
  prompt, with the branch/worktree selector beside the project and no
  duplicated Git strip above it. The selector distinguishes the current
  folder, other worktree folders and creation actions. Creation identifies
  the selected base and whether it uses a new or existing branch.
  In occupied Git chats, Changes is a small chip outside the prompt's upper
  left edge; the transparent branch chip below the prompt copies its name.
  The folder is available in its tooltip and execution context stays beside
  it. Prompt controls and text sizes use the existing composer primitives.
- **Changes preview** — a unified diff occupies the main reading area; the
  changed-file tree is on the right, open initially, with search and a toggle.
  The scope selector separates uncommitted, unstaged, staged and branch
  comparison. Branch comparison uses the chosen base without switching the
  checkout. Partially staged files expose both parts explicitly. Full context
  expands the same revision-correct patch. Commit labels describe the actual
  staged-or-all operation independently of scope, search and directory browsing.
  Non-repository, clean, failed, binary and missing historical-file states are
  distinct. Compact untracked directories expand only when opened.
- **Inline widgets** — a tool result that renders as a panel the user reads or
  acts on (clarify, artifact card) wears `WIDGET_SHELL_CLASS`
  (`src/components/chat/widget-shell.ts`): shared radius, the
  `--ui-widget-surface-background` fill, no border. Its actions sit *outside*
  the panel, below it. Don't give one widget its own radius or fill.
- **Attachment rows** — a delivered file in the transcript wears
  `ATTACHMENT_SHELL_CLASS` (same file): the same radius and padding, the
  `--ui-stroke-tertiary` hairline reserved for attachments, and a 5%
  `--ui-text-primary` mix on the chat field so the row still reads when
  widget fill equals the thread. Open + Download sit on the row.
- **Thread right-edge chrome** — the transcript scrollbar (`[data-slot='aui_thread-viewport']`)
  is the one grabable bar on a long chat: `--thread-scrollbar-size` (10px), a
  faint track, and a stronger thumb than the app-wide 4px gutters. The
  conversation timeline rail sits just inside that size so ticks and the thumb
  never share a hit target. Don't cover the gutter with overlay controls.
- Bordered surfaces in the transcript (tables, fences, callouts, attachments)
  use `--ui-stroke-tertiary`. Not `border-border` — that's the app-wide
  default and reads too hot against the thread.
- A tool result may expose an inline action that opens a preview. It must not
  open the rail automatically.
- Install, onboarding, connecting, boot failure, and reauthentication are
  distinct states with shared visual primitives. Preserve their recovery
  semantics when unifying appearance. First-run welcome is full-bleed on
  the chat surface (BrandMark, title, one line, one primary action) like
  the connecting overlay; Portal reauth and manual provider pick stay carded.
  Cold boot paints the existing shell (intro, last chat, composer
  "Starting Work4You…") while the gateway comes up. The full-bleed BrandMark
  plus `boot.connectingWork4You` with sequential `.` `..` `...` is DEV
  preview only (`?connecting=1`) — not a Loader around the mark, not
  DecodeText CONNECTING.
- Respect `AppShell` overlay ownership. Persistent terminal/content layers,
  route overlays, dialogs, and boot surfaces must not compete through ad-hoc
  z-index literals. Pick a rung of the ladder in `styles.css` instead —
  `--z-modal-backdrop` / `--z-modal` / `--z-modal-popover`, `--z-over-modal`
  (toasts, tooltips, command surfaces) and `--z-over-modal-content`,
  `--z-switcher-backdrop` / `--z-switcher`, then the boot chain
  `--z-connecting` → `--z-onboarding` → `--z-setup` → `--z-crash`. Plain
  `z-10`/`z-20` are still right for stacking *within* one component.

## Iconography & brand

- **Tabler** is the default component/chrome set. Import its curated aliases and
  `iconSize` scale from `src/lib/icons.ts`; do not import icon packages directly
  in feature code.
- **`Codicon`** is the compact editor/tool/status vocabulary. Use
  `src/components/ui/codicon.tsx`, including `codiconIcon()` where a
  Tabler-shaped component is required.
- Pick the vocabulary by semantic context and reuse the existing icon for an
  action. Do not introduce a third icon set or mix styles within one control
  group.
- **`BrandMark`** (`src/components/brand-mark.tsx`) is the brand glyph — the
  `work4you-icon` mark with its own transparent alpha, no tile. It replaced
  scattered Sparkles glyphs in updates / onboarding / about. Use it for
  hero/brand moments; don't reintroduce decorative star/sparkle icons.

## Motion

- Quick, functional transitions (~100ms on controls). Respect
  `prefers-reduced-motion` for anything beyond a fade.
- Choreographed exits (e.g. onboarding's "matrix" fade-down) stagger per-element
  then settle the surface — the outer container's fade is *delayed* so it
  doesn't swallow the inner animation. Don't let a global fade race the detail.
- Motion follows state; it never delays state. Selection, drag targets, cancel,
  and pressed feedback paint in the current frame.
- Do not animate layout geometry with `transition-all` on a hot interaction.
  Name the properties, avoid backdrop-filter repaints during movement, and
  remove animation before masking a performance problem.

## Direct manipulation & performance

The app should feel instant under real load — long transcripts, several panes,
live streams. Design toward that:

- Direct manipulation paints first; persistence reconciles after and rolls back
  visibly on failure.
- Keep interaction feedback cheap: hot-path state stays local or narrowly
  derived, not wired into heavy trees; pointer work coalesces per frame.
- One drop region has one visual owner, and drop targets speak one affordance
  language across files, sessions, tabs, and panes. Overlapping targets resolve
  to the active one instead of stacking overlays.
- Forgiving geometry beats pixel-perfect triggers; edge actions live near their
  edge, not clustered in the center.
- Expensive stateful surfaces stay mounted when hidden. Visibility is not
  lifecycle.

Prove speed with realistic content. A fast empty-state demo says nothing about a
long transcript or a busy terminal.

## Keyboard & cancellation

- Keyboard ownership follows focus. The focused surface wins its keys; shell
  shortcuts must not steal a terminal's or editor's bindings.
- Register global shortcuts through the shared layer, not ad-hoc listeners.
- One cancel gesture does one thing: cancel the active interaction, or close the
  topmost dismissable surface — never both, never the control underneath.
- Cancellation is synchronous in the UI even if cleanup is async: overlays,
  cursors, and pending gesture state clear at once.
- Flows that deliberately cannot be dismissed (install/onboarding, destructive
  confirmation) must make that explicit.

## i18n

- Every user-facing string goes through `useI18n()` (`src/i18n/context.tsx`).
  No literals in JSX.
- **Update all locales together** — `en`, `ja`, `zh`, `zh-hant`, `ar`, `pt`. A
  string change in `en.ts` that skips the others is a regression (drifted
  punctuation, stale labels). Keep trailing-punctuation and tone consistent
  across all of them.

## State (TypeScript)

The detailed state contract lives in the scoped
[`AGENTS.md`](./AGENTS.md). Visual code follows these essentials:

- Shared/cross-component state → small **nanostores**, not prop-drilling.
  Each feature owns its atoms; shared atoms live in `src/store`.
- Rendering components subscribe with `useStore`; non-render actions read with
  `$atom.get()`.
- Subscribe to derived coarse facts instead of high-frequency source atoms when
  the component does not render the full value.
- Colocated action modules over god hooks. A hook owns one narrow job.
- Keep persistence beside the atom that owns it. Route roots stay thin.
- Prefer `interface` for public props; extend React primitives
  (`React.ComponentProps<'button'>`, `Omit<…>`).

## Affordances

- `cursor-pointer` at the primitive level (Button, dropdown/select) — don't
  hardcode it per call site.
- Global focus-ring reset; titlebar actions have no active-background state.
- `Esc` closes every dismissable overlay/dialog (install/onboarding excluded);
  close is an x-icon, not the word "Close".

## Before you add something — checklist

- [ ] Reuse a primitive (`Button`, `SearchField`, `SegmentedControl`,
      `ListRow`, `Loader`, `ErrorState`, `LogView`) instead of forking one?
- [ ] Tokens (`--ui-*`, `shadow-work4you`, `--stroke-work4you`) — zero raw colors /
      one-off shadows?
- [ ] No `className` overriding a primitive's padding / size / radius / chrome?
- [ ] Tips only where hover teaches something new (no kebab / menu-trigger
      tips; unlabeled chrome that needs discovery gets `<Tip>` + `aria-label`)?
- [ ] No native `title=` on buttons?
- [ ] Keybind hints on tipped buttons use `useKeybindHint` / `TipKeybindLabel`?
- [ ] Overlay uses `shadow-work4you` + `border-(--stroke-work4you)`, no hard border?
- [ ] Flat — no card-in-card, no gratuitous row dividers?
- [ ] No automatic navigation, focus steal, or pane opening from background
      events?
- [ ] Direct manipulation paints immediately and rolls back cleanly on failure?
- [ ] Hot interactions avoid broad subscriptions, layout thrash, and
      `transition-all`?
- [ ] Keyboard ownership and single-action `Esc` behavior are correct?
- [ ] All locales updated for any new/changed string?
- [ ] `cursor-pointer`, focus ring, and `Esc`-to-close behave?
- [ ] Touched a primitive, token, or variant? Its named-contract entry in this
      file is updated in the same change.
