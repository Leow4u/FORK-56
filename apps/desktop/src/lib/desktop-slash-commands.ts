import { translateNow, type Translations } from '@/i18n'

export interface CommandsCatalogSection {
  name: string
  pairs: [string, string][]
}

export interface CommandsCatalogLike {
  categories?: CommandsCatalogSection[]
  pairs?: [string, string][]
  skill_count?: number
  skills?: SkillCatalogMap
  warning?: string
}

/**
 * Per-skill ranking data from `commands.catalog`, keyed by slash command.
 * Absent on older backends — every helper below degrades to "no ranking,
 * hide nothing".
 */
export interface SkillCatalogEntry {
  /** Where the skill came from; matches `/api/skills` provenance ('agent' = 'local'). */
  origin?: 'bundled' | 'hub' | 'local'
  /** Observed activity (use + view + patch) — the same number Capabilities shows. */
  usage?: number
}

export type SkillCatalogMap = Record<string, SkillCatalogEntry>

export interface DesktopSlashCompletion {
  display: string
  meta: string
  text: string
}

export interface DesktopThemeCommandOption {
  description: string
  label: string
  name: string
}

/**
 * Local client action a command resolves to. Each id maps to exactly one
 * handler in the dispatcher (`use-prompt-actions`), so adding a command never
 * means adding a branch to a switch ladder — you add a row here + a handler
 * keyed by the id.
 */
export type DesktopActionId =
  | 'branch'
  | 'browser'
  | 'compress'
  | 'handoff'
  | 'hatch'
  | 'help'
  | 'journey'
  | 'new'
  | 'pet'
  | 'profile'
  | 'skin'
  | 'title'
  | 'wake'
  | 'yolo'

/** A command fulfilled by opening a desktop overlay picker. */
export type DesktopPickerId = 'model' | 'session'

/** Why a known Work4You command has no desktop UI surface. */
export type DesktopUnavailableReason = 'advanced' | 'messaging' | 'settings' | 'terminal'

/**
 * How the desktop fulfils a command. This is the single discriminator the
 * dispatcher, popover, pills, and pickers all read — no parallel block-lists.
 *
 * - `action`     → handled by a local client handler (new chat, branch, …)
 * - `picker`     → opens an overlay (`/model`, `/resume`); a typed arg is
 *                  resolved by that picker instead of falling through
 * - `rpc`        → dedicated gateway RPC named on the surface. The dispatcher
 *                  calls it directly with the params built by `buildParams`,
 *                  bypassing `slash.exec` / `command.dispatch`. Reserved for
 *                  commands that have a first-class RPC handler in
 *                  `tui_gateway/server.py` (e.g. `/save` → session.save).
 * - `exec`       → runs on the backend via slash.exec / command.dispatch and
 *                  renders its text output inline. Only commands WITHOUT a
 *                  dedicated RPC should stay here.
 * - `unavailable`→ a known command with genuinely no desktop UI (terminal-only,
 *                  messaging-only, …); shows a reason instead of executing
 */
export type DesktopCommandSurface =
  | { kind: 'action'; action: DesktopActionId }
  | { kind: 'picker'; picker: DesktopPickerId }
  | {
      kind: 'rpc'
      rpc: string
      timeoutMs?: number
      buildParams: (ctx: SlashCommandBuildCtx) => Record<string, unknown>
    }
  | { kind: 'exec' }
  | { kind: 'unavailable'; reason: DesktopUnavailableReason }

/**
 * Inputs a `buildParams` function receives. The dispatcher passes session id,
 * the typed arg, and the canonical command name so handlers can construct
 * the exact JSON the gateway method expects.
 */
export interface SlashCommandBuildCtx {
  arg: string
  command: string
  name: string
  sessionId: string
}

/**
 * How arguments behave in the Desktop composer.
 *
 * - `options` → a finite completion list; picking or fully typing an option may
 *               commit the complete directive as a chip.
 * - `text`    → arbitrary prose; the command and its argument stay editable.
 * - `mixed`   → offers subcommand completions but also accepts arbitrary prose.
 */
export type DesktopSlashArgumentMode = 'mixed' | 'options' | 'text'

export interface DesktopCommandSpec {
  /** Canonical command, leading slash included (e.g. `/resume`). */
  name: string
  /**
   * Popover/help label in the active language, resolved each time it is read;
   * omitted for unavailable commands (never surfaced).
   */
  description?: () => string
  aliases?: string[]
  surface: DesktopCommandSurface
  /**
   * Hide from the slash popover / completions while still letting it execute.
   * Used for picker commands reachable from chrome (the model picker lives on
   * the status bar), so the popover doesn't dead-end on inline completion.
   */
  hidden?: boolean
  /** Composer behavior for text following the command token. */
  argumentMode?: DesktopSlashArgumentMode
}

const exec = (): DesktopCommandSurface => ({ kind: 'exec' })
const action = (id: DesktopActionId): DesktopCommandSurface => ({ kind: 'action', action: id })
const picker = (id: DesktopPickerId): DesktopCommandSurface => ({ kind: 'picker', picker: id })
const unavailable = (reason: DesktopUnavailableReason): DesktopCommandSurface => ({ kind: 'unavailable', reason })

/**
 * Route a command directly to its dedicated gateway RPC. Prefer this over
 * `exec()` whenever `tui_gateway/server.py` exposes a `@method(...)` for the
 * command — bypassing `slash.exec` keeps the path short and the response
 * structured.
 *
 * The dispatcher calls `requestGateway(surface.rpc, surface.buildParams(ctx))`
 * and then runs `renderRpcResult` to format the response.
 */
const rpc = (
  rpcName: string,
  buildParams: (ctx: SlashCommandBuildCtx) => Record<string, unknown>,
  timeoutMs?: number
): DesktopCommandSurface => ({ kind: 'rpc', rpc: rpcName, timeoutMs, buildParams })

type SlashCommandCopy = Translations['composer']['slashCommands']

// Copy is looked up when it is read, never when this module loads: the module
// initializes before the user's language is applied, and the language can
// change while the app runs. The keys are typed against the catalog.
const describe = (key: keyof SlashCommandCopy['descriptions']) => () =>
  translateNow(`composer.slashCommands.descriptions.${key}`)

const unavailableCopy = (key: keyof SlashCommandCopy['unavailable']) => (command: string) =>
  translateNow(`composer.slashCommands.unavailable.${key}`, command)

const skinCopy = (key: keyof SlashCommandCopy['skin']) => translateNow(`composer.slashCommands.skin.${key}`)

/**
 * THE source of truth for desktop slash commands. Everything below — execution
 * gating, popover suggestions, catalog filtering, pill grouping, and the
 * dispatcher's behavior — derives from this one table.
 */
const DESKTOP_COMMAND_SPECS: readonly DesktopCommandSpec[] = [
  // Local client actions
  { name: '/new', description: describe('newChat'), aliases: ['/reset'], surface: action('new') },
  {
    name: '/branch',
    description: describe('branch'),
    aliases: ['/fork'],
    surface: action('branch')
  },
  { name: '/yolo', description: describe('yolo'), surface: action('yolo') },
  {
    name: '/wake',
    description: describe('wake'),
    surface: action('wake'),
    argumentMode: 'options'
  },
  {
    name: '/handoff',
    description: describe('handoff'),
    surface: action('handoff'),
    argumentMode: 'options'
  },
  { name: '/profile', description: describe('profile'), surface: action('profile') },
  {
    name: '/skin',
    description: describe('skin'),
    surface: action('skin'),
    argumentMode: 'options'
  },
  { name: '/title', description: describe('title'), surface: action('title'), argumentMode: 'text' },
  { name: '/help', description: describe('help'), aliases: ['/commands'], surface: action('help') },
  {
    name: '/browser',
    description: describe('browser'),
    surface: action('browser'),
    argumentMode: 'options'
  },
  {
    name: '/journey',
    description: describe('journey'),
    aliases: ['/learning', '/memory-graph'],
    surface: action('journey')
  },

  // Overlay pickers
  { name: '/model', description: describe('model'), surface: picker('model'), hidden: true },
  {
    name: '/resume',
    description: describe('resume'),
    aliases: ['/sessions', '/switch'],
    surface: picker('session'),
    // `mixed`, not `options`: the argument is a free-text search the picker
    // fuzzy-matches against titles and previews, so multi-word queries have to
    // stay typeable. Its completion list also always carries a trailing
    // "Browse all sessions…" action row, which meant Space-to-accept could
    // never fall through — the first space wiped the composer and threw the
    // user into the overlay.
    argumentMode: 'mixed'
  },

  // Backend-executed commands that render useful inline output.
  // Commands with a dedicated gateway RPC (@method in tui_gateway/server.py)
  // route to it directly via `rpc(...)` — bypassing slash.exec avoids the
  // slash-worker pipe timeout and the "not a quick/plugin/skill command"
  // fallback noise for commands the dispatcher doesn't handle inline.
  // These commands have gateway RPCs, but their established desktop behavior
  // carries richer CLI semantics: /agents includes delegations, /stop cancels
  // them, /steer falls back to a next-turn prompt, and /usage is a formatted
  // live report. Keep them on slash.exec until their RPC contracts are fully
  // equivalent.
  {
    name: '/approvals',
    description: describe('approvals'),
    surface: exec(),
    argumentMode: 'options'
  },
  {
    name: '/agents',
    description: describe('agents'),
    aliases: ['/tasks'],
    surface: exec()
  },
  {
    name: '/background',
    description: describe('background'),
    aliases: ['/bg', '/btw'],
    surface: exec(),
    argumentMode: 'text'
  },
  // /compress must be an action (session.compress RPC), not exec: the slash
  // worker route times out on large sessions (30s WS / 45s pipe) before the
  // LLM summarise call finishes, then command.dispatch surfaces a bogus
  // "not a quick/plugin/skill command: compress" (#44456).
  {
    name: '/compress',
    description: describe('compress'),
    aliases: ['/compact'],
    surface: action('compress'),
    argumentMode: 'text'
  },
  { name: '/debug', description: describe('debug'), surface: exec() },
  {
    name: '/goal',
    description: describe('goal'),
    surface: exec(),
    argumentMode: 'mixed'
  },
  {
    name: '/loop',
    description: describe('loop'),
    aliases: ['/proactive'],
    surface: exec(),
    argumentMode: 'mixed'
  },
  {
    name: '/personality',
    description: describe('personality'),
    surface: exec(),
    argumentMode: 'options'
  },
  {
    name: '/pet',
    description: describe('pet'),
    surface: action('pet'),
    argumentMode: 'options'
  },
  {
    name: '/hatch',
    description: describe('hatch'),
    aliases: ['/generate-pet'],
    surface: action('hatch')
  },
  {
    name: '/queue',
    description: describe('queue'),
    aliases: ['/q'],
    surface: exec(),
    argumentMode: 'text'
  },
  { name: '/retry', description: describe('retry'), surface: exec() },
  { name: '/rollback', description: describe('rollback'), surface: exec() },
  {
    name: '/save',
    description: describe('save'),
    surface: rpc('session.save', ctx => ({ session_id: ctx.sessionId }))
  },
  {
    name: '/status',
    description: describe('status'),
    surface: rpc('session.status', ctx => ({ session_id: ctx.sessionId }))
  },
  {
    name: '/steer',
    description: describe('steer'),
    surface: exec(),
    argumentMode: 'text'
  },
  { name: '/stop', description: describe('stop'), surface: exec() },
  {
    name: '/tools',
    description: describe('tools'),
    surface: exec(),
    argumentMode: 'options'
  },
  { name: '/undo', description: describe('undo'), surface: exec() },
  { name: '/usage', description: describe('usage'), surface: exec() },
  { name: '/version', description: describe('version'), surface: exec() },

  // No desktop surface, but carry an alias (underscore spelling variants).
  { name: '/reload-mcp', aliases: ['/reload_mcp'], surface: unavailable('advanced') },
  { name: '/reload-skills', aliases: ['/reload_skills'], surface: unavailable('advanced') }
]

// Known commands with no desktop surface (and no alias) — a flat name list
// per reason beats 40 identical object literals.
const NO_DESKTOP_SURFACE: Record<DesktopUnavailableReason, readonly string[]> = {
  terminal: [
    '/busy',
    '/clear',
    '/config',
    '/copy',
    '/cron',
    '/density',
    '/details',
    '/exit',
    '/footer',
    '/gateway',
    '/history',
    '/image',
    '/indicator',
    '/logs',
    '/mouse',
    '/paste',
    '/platforms',
    '/plugins',
    '/quit',
    '/redraw',
    '/reload',
    '/restart',
    '/sb',
    '/set-home',
    '/sethome',
    '/snap',
    '/snapshot',
    '/statusbar',
    '/toolsets',
    '/update',
    '/verbose'
  ],
  messaging: ['/approve', '/deny'],
  settings: ['/skills', '/pets'],
  advanced: ['/curator', '/fast', '/insights', '/kanban', '/reasoning', '/voice']
}

const ALL_SPECS: readonly DesktopCommandSpec[] = [
  ...DESKTOP_COMMAND_SPECS,
  ...(Object.entries(NO_DESKTOP_SURFACE) as [DesktopUnavailableReason, readonly string[]][]).flatMap(
    ([reason, names]) => names.map(name => ({ name, surface: unavailable(reason) }))
  )
]

const SPEC_BY_NAME = new Map<string, DesktopCommandSpec>(ALL_SPECS.map(spec => [spec.name, spec]))

const ALIAS_TO_CANONICAL = new Map<string, string>(
  ALL_SPECS.flatMap(spec => (spec.aliases ?? []).map(alias => [alias, spec.name] as const))
)

const UNAVAILABLE_MESSAGE: Record<DesktopUnavailableReason, (command: string) => string> = {
  advanced: unavailableCopy('advanced'),
  messaging: unavailableCopy('messaging'),
  settings: unavailableCopy('settings'),
  terminal: unavailableCopy('terminal')
}

const PICKER_UNAVAILABLE_MESSAGE: Record<DesktopPickerId, (command: string) => string> = {
  model: unavailableCopy('modelPicker'),
  session: unavailableCopy('sessionPicker')
}

function normalizeCommand(command: string): string {
  const trimmed = command.trim()
  const base = (trimmed.startsWith('/') ? trimmed : `/${trimmed}`).split(/\s+/, 1)[0]?.toLowerCase() || ''

  return base
}

export function canonicalDesktopSlashCommand(command: string): string {
  const normalized = normalizeCommand(command)

  return ALIAS_TO_CANONICAL.get(normalized) || normalized
}

/** Resolve a command (or alias) to its desktop spec, or null for unknown/extension commands. */
export function resolveDesktopCommand(command: string): DesktopCommandSpec | null {
  return SPEC_BY_NAME.get(canonicalDesktopSlashCommand(command)) ?? null
}

function isKnownWork4YouSlashCommand(command: string): boolean {
  const normalized = normalizeCommand(command)

  return SPEC_BY_NAME.has(normalized) || ALIAS_TO_CANONICAL.has(normalized)
}

/**
 * An "extension" command is anything the backend surfaces that is NOT one of
 * Work4You' built-in slash commands — i.e. skill commands (`/gif-search`,
 * `/codex`, …) and user-defined quick commands. These are user-activated, so
 * they appear in the desktop slash palette and execute when typed.
 */
export function isDesktopSlashExtensionCommand(command: string): boolean {
  const normalized = normalizeCommand(command)

  if (!normalized || normalized === '/') {
    return false
  }

  return !isKnownWork4YouSlashCommand(normalized)
}

/** Gates execution: true unless the command is a known no-desktop-surface command. */
export function isDesktopSlashCommand(command: string): boolean {
  const spec = resolveDesktopCommand(command)

  if (spec) {
    return spec.surface.kind !== 'unavailable'
  }

  return isDesktopSlashExtensionCommand(command)
}

/** Gates discovery in the popover/completions. */
export function isDesktopSlashSuggestion(command: string): boolean {
  const normalized = normalizeCommand(command)

  // Aliases stay hidden so the popover isn't cluttered with duplicates.
  if (ALIAS_TO_CANONICAL.has(normalized)) {
    return false
  }

  const spec = SPEC_BY_NAME.get(normalized)

  if (spec) {
    return spec.surface.kind !== 'unavailable' && !spec.hidden
  }

  // Skill / quick commands the backend provides.
  return isDesktopSlashExtensionCommand(normalized)
}

/**
 * True for commands the desktop fulfils by opening an overlay picker
 * (`/model`, `/resume`/`/sessions`/`/switch`). Optionally pin to one picker.
 */
export function isPickerCommand(command: string, picker?: DesktopPickerId): boolean {
  const surface = resolveDesktopCommand(command)?.surface

  if (surface?.kind !== 'picker') {
    return false
  }

  return picker ? surface.picker === picker : true
}

/** Back-compat shim for the model picker check. */
export function isModelPickerCommand(command: string): boolean {
  return isPickerCommand(command, 'model')
}

export function desktopSlashUnavailableMessage(command: string): string | null {
  const canonical = canonicalDesktopSlashCommand(command)
  const surface = SPEC_BY_NAME.get(canonical)?.surface

  if (!surface) {
    return null
  }

  if (surface.kind === 'unavailable') {
    return UNAVAILABLE_MESSAGE[surface.reason](canonical)
  }

  if (surface.kind === 'picker') {
    return PICKER_UNAVAILABLE_MESSAGE[surface.picker](canonical)
  }

  return null
}

export function desktopSlashDescription(command: string, fallback = ''): string {
  return SPEC_BY_NAME.get(canonicalDesktopSlashCommand(command))?.description?.() || fallback
}

export function desktopSlashCommandArgumentMode(command: string): DesktopSlashArgumentMode | null {
  return resolveDesktopCommand(command)?.argumentMode ?? null
}

export function desktopSkinSlashCompletions(
  themes: DesktopThemeCommandOption[],
  activeThemeName: string,
  argPrefix: string
): DesktopSlashCompletion[] {
  const prefix = argPrefix.trim().toLowerCase()

  const commands: DesktopSlashCompletion[] = [
    {
      text: '/skin list',
      display: '/skin list',
      meta: skinCopy('list')
    },
    {
      text: '/skin next',
      display: '/skin next',
      meta: skinCopy('next')
    },
    ...themes.map(theme => ({
      text: `/skin ${theme.name}`,
      display: `/skin ${theme.name}`,
      meta: `${theme.label}${theme.name === activeThemeName ? skinCopy('current') : ''} - ${theme.description}`
    }))
  ]

  if (!prefix) {
    return commands
  }

  return commands.filter(item => item.text.slice('/skin '.length).toLowerCase().startsWith(prefix))
}

/**
 * Order skill rows by how much the user actually uses them, most-used first,
 * A–Z within a tie. A `/` menu sorted alphabetically buries the handful of
 * skills someone reaches for daily under a hundred they have never opened.
 *
 * `hideBundled` drops every shipped skill, used or not. The menu stops
 * suggesting natives; typing the command still runs it, and the agent still
 * loads the ones that are enabled. `pruneUnusedBuiltins` is the narrower
 * browse-only cut (never-used shipped skills) kept for callers that have
 * not opted into hiding the whole native set.
 *
 * Older backends send no `skills` map; then nothing is reordered or dropped.
 */
export function rankSkillCommands<T extends { text: string }>(
  rows: readonly T[],
  skills: SkillCatalogMap | undefined,
  { hideBundled = false, pruneUnusedBuiltins = false }: { hideBundled?: boolean; pruneUnusedBuiltins?: boolean } = {}
): T[] {
  if (!skills) {
    return [...rows]
  }

  const entryOf = (row: T): SkillCatalogEntry | undefined => skills[canonicalDesktopSlashCommand(row.text)]
  const usageOf = (row: T): number => entryOf(row)?.usage ?? 0

  const kept = rows.filter(row => {
    const entry = entryOf(row)

    // Unknown to the map (a quick command, a newer skill the catalog
    // hasn't classified) stays — only a confirmed bundled skill is hidden.
    if (!entry || entry.origin !== 'bundled') {
      return true
    }

    if (hideBundled) {
      return false
    }

    return !pruneUnusedBuiltins || (entry.usage ?? 0) > 0
  })

  return kept.sort((a, b) => usageOf(b) - usageOf(a) || a.text.localeCompare(b.text))
}

function isBundledSkillCommand(command: string, skills: SkillCatalogMap | undefined): boolean {
  return skills?.[canonicalDesktopSlashCommand(command)]?.origin === 'bundled'
}

export function filterDesktopCommandsCatalog(catalog: CommandsCatalogLike): CommandsCatalogLike {
  const listed = (command: string) =>
    isDesktopSlashSuggestion(command) && !isBundledSkillCommand(command, catalog.skills)

  const categories = catalog.categories
    ?.map(section => ({
      ...section,
      pairs: section.pairs
        .filter(([command]) => listed(command))
        .map(([command, description]) => [command, desktopSlashDescription(command, description)] as [string, string])
    }))
    .filter(section => section.pairs.length > 0)

  const pairs = catalog.pairs
    ?.filter(([command]) => listed(command))
    .map(([command, description]) => [command, desktopSlashDescription(command, description)] as [string, string])

  // Recount skill commands from the filtered output so /help's footer reflects
  // what the user actually sees. Backend's skill_count includes commands the
  // desktop hides (terminal-only, picker-owned, advanced), producing a footer
  // like "60 skill commands available" while only ~29 appear in the list.
  const filteredCommands = new Set<string>()

  for (const section of categories ?? []) {
    for (const [command] of section.pairs) {
      filteredCommands.add(canonicalDesktopSlashCommand(command))
    }
  }

  for (const [command] of pairs ?? []) {
    filteredCommands.add(canonicalDesktopSlashCommand(command))
  }

  let skillCount = 0

  for (const command of filteredCommands) {
    if (isDesktopSlashExtensionCommand(command)) {
      skillCount += 1
    }
  }

  const hasSkillCount = catalog.skill_count !== undefined || skillCount > 0

  return {
    ...catalog,
    ...(categories ? { categories } : {}),
    ...(pairs ? { pairs } : {}),
    ...(hasSkillCount ? { skill_count: skillCount } : {})
  }
}
