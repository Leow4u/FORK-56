/**
 * Work4You Bot Mode — a "one chat per agent" roster for the Work4You desktop.
 *
 * Left pane "Bots": one row per Work4You profile (a bot = an agent profile) with
 * a customizable avatar (shape + color + eyes, image, or pet). Click opens that
 * bot's chat; right-click → Edit Profile (avatar, title, description).
 * "New Agent" creates a profile — Name / Title / Description with an
 * "Advanced" disclosure for full profile config.
 *
 * Right tile "Routines": scheduled tasks (Work4You cron jobs) scoped to the
 * bot you're currently chatting with — follows the live gateway profile.
 *
 * Bots message each other straight into each bot's ONE canonical "Bot
 * Chat" — @-mentions deliver over gateway RPCs (no CLI relay), and
 * bot-initiated sends use `work4you -p <bot> chat --in ~ -c "Bot Chat"`.
 */

import * as sdk from '@work4you/plugin-sdk'
import {
  atom,
  Button,
  Checkbox,
  cn,
  Codicon,
  COMPOSER_AREAS,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  ConfirmDialog,
  CopyButton,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  GlyphSpinner,
  haptic,
  host,
  Input,
  PALETTE_AREA,
  profileColor,
  queryClient,
  relativeTime,
  ScrollArea,
  SearchField,
  SegmentedControl,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
  Tip,
  useQuery,
  useValue
} from '@work4you/plugin-sdk'
import { useEffect, useId, useRef, useState } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'

const { McpTab, ToolsetConfigPanel } = sdk
// Keep optional exports feature-detected; test harnesses may strip the SDK namespace.
const SkillsView = typeof sdk === 'undefined' ? undefined : sdk.SkillsView
// TRUE only on builds whose SkillsView routes `fixedConnection` to the pinned
// registry connection's backend. Older builds export SkillsView WITHOUT the
// prop — rendering it for a remote-target draft there would read/write the
// ACTIVE gateway's skills under the remote bot's name (the wrong machine),
// so those builds keep the staged checklists for remote targets.
const skillsViewRoutesConnections = Boolean(SkillsView && SkillsView.supportsFixedConnection)
const Streamdown = typeof sdk === 'undefined' ? undefined : sdk.Streamdown
// Deterministic blob avatars (name → face). Feature-detected: older SDKs
// without the export fall back to the legacy math-face shapes below.
const blobatarSvg = typeof sdk === 'undefined' ? undefined : sdk.blobatarSvg
// Budgeted render loop (fps cap + observability pause + dormancy + teardown).
// Feature-detected: older desktops fall back to the hand-rolled clock below.
const createBudgetedLoop = typeof sdk === 'undefined' ? undefined : sdk.createBudgetedLoop
// Commercial catalog chrome (Operis 5.0, Claude Opus 5, …). Older SDKs without
// the export keep the wire id so the plugin still loads on a stale desktop.
const displayModelName =
  typeof sdk === 'undefined' || typeof sdk.displayModelName !== 'function'
    ? mid => String(mid || '')
    : sdk.displayModelName
// Plugin pages (a full page in the workspace pane). Feature-detected: older
// desktops without the export keep the group room inside the Bots pane.
const ROUTES_AREA = typeof sdk === 'undefined' ? undefined : sdk.ROUTES_AREA

const ID = 'work4you-bots'
const ROSTER_KEY = [ID, 'roster']
const ROUTINES_KEY = [ID, 'routines']
const NAME_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/

/** Captured in register() so components can reach plugin storage. */
let pluginCtx = null

// Bot Mode's copy. English is the source; `pt` is Brazilian Portuguese; any
// other language falls back to English. Registered with the app's plugin i18n
// (ctx.i18n.register) when the host has it.
const BOT_MODE_LOCALES = {
  en: {
    common: {
      back: 'Back',
      cancel: 'Cancel',
      description: 'Description',
      generate: 'Generate',
      generating: 'Generating…',
      name: 'Name',
      remove: 'Remove',
      retry: 'Retry',
      save: 'Save',
      saving: 'Saving…',
      title: 'Title',
      upload: 'Upload'
    },
    notify: {
      newMessage: label => `🤖 New message for ${label}`,
      newActivity: label => `${label} has new activity`,
      openToSee: 'Open the chat to see it.'
    },
    roster: {
      copyTitle: title => `${title} (copy)`,
      noFreeName: 'No free name for the duplicate.',
      deleteFailed: name => `Could not delete profile ${name}.`,
      noConversations: 'No conversations yet — say hi',
      openFailed: name => `Could not open ${name}'s chat — try again`,
      pinned: 'Pinned',
      hiddenFromRoster: 'Hidden from the roster',
      livesOn: label => `Lives on ${label}`,
      unread: 'unread',
      activeRecently: 'Active in the last 90s',
      lastFromBot: handle => `Last message came from @${handle} (bot-to-bot)`,
      pinnedToTop: name => `${name} pinned to top`,
      unpinned: name => `${name} unpinned`,
      backInRoster: name => `${name} is back in the roster`,
      hiddenNotice: name => `${name} hidden — use the eye button in the Bots header to see hidden bots`,
      duplicating: name => `Duplicating ${name}…`,
      duplicated: (name, source) => `Created ${name} — full copy of ${source}`,
      duplicateFailed: 'Duplicate failed',
      menu: {
        pin: 'Pin to top',
        unpin: 'Unpin',
        hide: 'Hide Bot',
        unhide: 'Unhide Bot',
        sessions: 'Sessions',
        editProfile: 'Edit Profile',
        groups: groups => `Groups: ${groups}…`,
        manageGroups: 'Manage groups…',
        duplicate: 'Duplicate',
        newChat: 'New chat with this agent',
        delete: 'Delete'
      },
      activeNow: 'Active now',
      openChat: label => `Open ${label}'s chat`,
      staleNotice: 'Roster refresh failed — showing the last good list.',
      waitingReconnect: ' Waiting for the gateway to reconnect…',
      toastsOn: 'Activity toasts on — click to silence',
      toastsOff: 'Activity toasts off — click to enable',
      hideHiddenAgain: 'Hide hidden bots again',
      showHiddenCount: count => `Show ${count} hidden bot${count === 1 ? '' : 's'}`,
      hideHidden: 'Hide hidden bots',
      showHidden: 'Show hidden bots',
      hiddenUnread: 'a hidden bot has unread activity',
      newMenu: 'New…',
      newMenuLabel: 'New agent or group chat',
      newAgent: 'New Agent',
      newGroupChat: 'New Group Chat',
      searchLabel: 'Search bots',
      searchBots: 'Search bots…',
      unavailable: reason =>
        `Roster unavailable: ${reason}. If your gateway predates profiles.list, update Work4You and restart the gateway.`,
      gatewayError: 'gateway error',
      waitingConnection:
        'Waiting for the gateway connection… (remote gateways can take a few seconds; retries automatically)',
      retryNow: 'Retry now',
      emptyTitle: 'No agents yet',
      emptyDescription: 'Create your first teammate.',
      noMatch: query => `No bots match “${query}”`,
      allHidden: 'All bots are hidden — use the eye button above to show them.',
      deleteDialog: {
        title: 'Delete bot and profile?',
        bodyStart: 'This will permanently delete the bot ',
        bodyMiddle: ' and its associated Work4You profile at ',
        bodyEnd: '. This cannot be undone.',
        confirm: 'Delete',
        busy: 'Deleting…',
        done: 'Deleted'
      },
      deleted: name => `Deleted profile ${name}`
    },
    remote: {
      noSession: 'No remote session',
      messaged: (handle, label) => `Messaged @${handle} on ${label} — will relay the reply here.`,
      noReply: (handle, label) => `No reply from @${handle} yet — check its Bot Chat on ${label}.`,
      reachFailed: label => `Could not reach ${label}`,
      remoteSource: 'the remote source',
      updateDesktop: 'Update Work4You Desktop to chat with agents on other connections.',
      stillOn: (current, target) => `Still on ${current}, not ${target}`,
      thisDevice: 'this device',
      stayInChat: handle => `Stay in this chat and @${handle} to message them. Gateway stays on this device.`
    },
    sessions: {
      cannotOpenStored: 'This Work4You Desktop version cannot open stored sessions',
      openFailed: 'Could not open session',
      untitled: 'Untitled session',
      noMessages: 'No messages yet',
      title: name => `${name} sessions`,
      filterLabel: 'Filter sessions',
      filterPlaceholder: 'Filter sessions…',
      showingRecent: count => `Showing the ${count} most recent sessions.`,
      loadFailed: 'Could not load sessions for this profile.',
      noMatchRecent: count => `No matching sessions in the ${count} most recent.`,
      noMatch: 'No sessions match that filter.',
      empty: 'No stored sessions yet.',
      conversation: 'Conversation'
    },
    avatar: {
      tabs: { bot: 'Bot', generate: 'Generate', upload: 'Upload', pet: 'Pet' },
      imageTooLarge: 'Image too large (max 15MB).',
      generationFailed: 'generation failed',
      generateFailed: 'Avatar generation failed',
      removeImage: 'Remove image — use shape',
      blobAuto: 'Auto',
      blobAutoHint: 'Auto — the name decides',
      randomize: 'Randomize',
      unlockHint: 'Unlock — the face follows the agent’s name again',
      lockHint: 'Keep this exact face even if the name changes',
      unlock: 'Unlock',
      lockFace: 'Lock face',
      faceLocked: 'Face locked — renaming won’t change it.',
      faceFollowsName: 'Face follows the name.',
      classicShapes: 'Classic shapes',
      blobFace: 'Blob face — drawn from the agent’s name',
      describe: 'Describe your avatar…',
      generateHint: 'Leave blank to generate from the agent’s name and description.',
      noImageModel:
        'No image model available. If you just enabled one (or updated Work4You), restart the gateway: Ctrl+K → "Restart gateway".',
      checkingImageModel: 'Checking image backend…',
      chooseImage: 'Choose an image…',
      noPets: 'No pets in the petdex gallery. Run `work4you pets` to explore.',
      petPick: 'Pick a pet as this agent’s profile picture.',
      petSearch: count => `Search ${count} pets…`,
      removePet: 'Remove — back to shape avatar',
      noPetsMatch: 'No pets match.',
      petFailed: 'Could not load that pet — try another.',
      scrollMore: (shown, total) => `Scroll for more (${shown} of ${total})`
    },
    attachments: {
      tooLarge: name => `${name}: too large (max 15MB).`,
      unnamed: 'attachment'
    },
    mcp: {
      addFailed: 'Could not add server',
      noProfile: 'No target profile',
      setKeyFailed: key => `Failed to set ${key}`,
      configured: name => `${name} configured`,
      testFailed: 'Server test failed after setup',
      oauthStartFailed: 'Could not start OAuth',
      completeSignIn: 'Complete sign-in in your browser...',
      authenticated: name => `${name} authenticated`,
      oauthFailed: 'OAuth failed',
      needsSetup: keys => `needs setup (${keys}) — restart the gateway to enable in-app setup`,
      setUpDone: 'set up ✓',
      saveAndTest: 'Save & test',
      authorizing: 'Authorizing…',
      working: 'Working…',
      setupFailed: 'Setup failed',
      retry: 'retry',
      signIn: 'Sign in…',
      setUp: 'Set up…'
    },
    model: {
      gatewayDefault: 'gateway default',
      namePlaceholder: 'e.g. model name',
      provider: 'Provider',
      model: 'Model',
      providerCustom: 'Provider (Custom)',
      modelCustom: 'Model (Custom)',
      providerExample: 'e.g. omnirouter, inferx, 9router',
      modelExample: 'e.g. antigravity/gemini-3.6-flash-high',
      backToDropdowns: '← Back to dropdowns',
      inherit: 'Inherit (launch profile)',
      enterManually: '✏️ Enter manually…',
      proNeedsSubscription: 'Pro models need a paid Work4You subscription.'
    },
    config: {
      needsNewerGateway: 'Full configuration needs a newer gateway (restart it after updating Work4You).',
      capabilities: 'Capabilities (applies immediately — skills, tools, MCP)',
      soul: 'SOUL.md (persona + agent-messaging protocol)',
      skills: (enabled, total) => `Skills (${enabled}/${total} enabled)`,
      filterSkills: 'Filter skills…',
      toolsets: (enabled, total) => `Toolsets (${enabled}/${total} enabled — unchecking all restores the default)`,
      mcpServers: 'MCP servers',
      noMcp: 'No MCP servers configured or in the catalog.',
      catalogInstalled: 'catalog · installed',
      catalog: 'catalog'
    },
    hub: {
      installed: name => `Skill "${name}" installed`,
      installFailed: name => `Installing "${name}" failed`,
      title: 'Skills Hub',
      hideBrowser: 'hide the hub browser',
      browseFull: 'browse the full hub ▾',
      frameTitle: 'Work4You Skills Hub',
      installing: name => `Installing "${name}"…`,
      pickerHint:
        'Hit "+ Add to this Agent" on any skill — it installs and appears in the list above. Drag the corner to resize.',
      searchPlaceholder: 'Search the hub (community + well-known sources)…',
      searching: 'Searching…',
      search: 'Search',
      searchingHint: 'Searching community + well-known sources — can take ~10s…',
      noResults: 'No hub skills matched.',
      added: '✓ added',
      installTitle: name => `Install "${name}" and add it to the list above`
    },
    edit: {
      lookRemoteFailed: 'Saved look locally; remote persistence failed',
      descriptionFailed: 'Saved look locally; description update failed',
      sectionsFailed: sections => `Some sections failed: ${sections}`,
      advancedFailed: 'Advanced configuration failed',
      updated: name => `${name} updated`,
      title: 'Edit Profile',
      subtitle: (name, profile) => `Appearance and role for ${name} (${profile}).`,
      descriptionPlaceholder: 'What should this agent help with?',
      advanced: 'Advanced — model, skills, toolsets, SOUL.md'
    },
    create: {
      retry: 'Try again',
      instructionsPlaceholder: 'Leave blank to use automatic instructions.',
      instructionsHint: 'Replaces instructions generated from the name, title and description.',
      instructions: 'Agent instructions (optional)',
      appearanceHint: 'This agent’s appearance throughout the app.',
      startCopy: 'Copy from',
      startFresh: 'Fresh',
      startFrom: 'Starting point',
      capabilitiesHint: 'Skills, MCP and Plugins',
      customizeCapabilities: 'Customize capabilities',
      capabilitiesDescription: 'Choose what this agent can do.',
      settingsDescription: 'Adjust how this agent will work.',
      settingsHint: 'Model and instructions',
      settingsTitle: 'Agent settings',
      settings: 'Settings',
      back: 'Back to agent',
      draftDiscarded: name => `Draft agent "${name}" discarded`,
      draftCleanupFailed: name => `Could not clean up draft profile "${name}"`,
      failed: 'Could not create the agent.',
      createdOn: (name, target) => `Agent "${name}" created on ${target}`,
      created: name => `Agent "${name}" created`,
      title: 'New Agent',
      subtitle: 'Choose the appearance and how this agent will work.',
      namePlaceholder: 'research-assistant',
      takenOn: (slug, target) => `An agent named "${slug}" already exists on ${target}.`,
      taken: slug => `An agent named "${slug}" already exists.`,
      createOn: 'Create on',
      current: label => `${label} (current)`,
      remoteHint: target =>
        `The agent is created on ${target} and appears in the roster as a Connections bot. Chat routes to that machine.`,
      titlePlaceholder: 'Research assistant',
      descriptionPlaceholder: 'What should this Bot help with?',
      advanced: 'Advanced',
      tabs: { general: 'General', capabilities: 'Capabilities', skills: 'Skills', toolsets: 'Tools', mcp: 'MCP' },
      profileNotReady: 'Could not create the profile yet',
      cloneFromOn: target => `Clone from profile (on ${target})`,
      cloneFrom: 'Clone from profile',
      fresh: 'Fresh profile (bundled skills)',
      soulLabel: 'SOUL.md (optional — replaces the generated persona)',
      soulPlaceholder: 'Leave blank to auto-generate from name/title/description + agent-messaging roster.',
      shareAuth: 'Share OAuth logins with the main profile',
      shareAuthHint:
        'OAuth logins stay shared (not copied), so token refreshes never invalidate each other. Uncheck for an isolated auth snapshot. Fresh does not copy .env or WhatsApp from the main profile — pick Clone to copy those.',
      noSkills: 'Create empty (skip bundled skills)',
      nameTaken: 'That name is taken — pick another before configuring capabilities.',
      nameFirst: 'Give the agent a name before customizing capabilities.',
      catalogNeedsGateway: 'Capability catalog needs a newer gateway (restart it after updating Work4You).',
      noSkillsChecked: '“Create empty” is checked — no bundled skills will be installed.',
      freshSkillsHint:
        'Fresh profile — bundled skills are seeded after create. Open Capabilities after naming the agent to edit the real catalog, or clone a profile to preview its skills here.',
      catalogFrom: source => `Catalog from ${source} — unchecked skills are disabled after creation.`,
      toolsetsHint: 'Leaving all (or none) checked keeps the default toolset behavior.',
      mcpHint:
        'Configured servers copy from the main profile; catalog entries are the bundled MCP menu. Entries needing API keys route through setup first (credentials follow the shared keys setting).',
      creating: 'Creating…',
      submit: 'Create Agent',
      canonicalKickoff: 'Hey, tell me about yourself!'
    },
    routines: {
      untitled: 'Untitled cronjob',
      filterHint:
        'Cronjobs exist in this profile but none are tagged for this bot. Name a job "[bot:<name>] …" to show it here, or see them in Cron below.',
      nameNul: 'Cronjob name cannot contain NUL (U+0000).',
      instructionNul: 'Cronjob instruction cannot contain NUL (U+0000).',
      schedule: {
        once: when => `Once (${when})`,
        daily: 'Daily',
        everyDays: count => `Every ${count} days`,
        hourly: 'Hourly',
        everyHours: count => `Every ${count}h`,
        everyMinutes: count => `Every ${count}m`
      },
      updateFailed: 'Cronjob update failed',
      delete: 'Delete cronjob',
      next: when => `next ${when}`,
      paused: 'paused',
      legacyPaused: 'Paused for security: delete and recreate this legacy cronjob before running it again.',
      frequency: {
        once: 'Once, in…',
        hourly: 'Every hour',
        daily: 'Every day',
        weekdays: 'Weekdays',
        weekly: 'Every week',
        monthly: 'Every month',
        interval: 'Interval',
        advanced: 'Advanced…'
      },
      weekdays: {
        monday: 'Monday',
        tuesday: 'Tuesday',
        wednesday: 'Wednesday',
        thursday: 'Thursday',
        friday: 'Friday',
        saturday: 'Saturday',
        sunday: 'Sunday'
      },
      timeOfDay: (hour, minute) =>
        `${hour % 12 === 0 ? 12 : hour % 12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`,
      summary: {
        once: (count, unit) =>
          `Runs once, ${count} ${unit === 'm' ? 'minute(s)' : unit === 'd' ? 'day(s)' : 'hour(s)'} from now`,
        hourly: 'Runs at the top of every hour',
        daily: time => `Runs every day at ${time}`,
        weekdays: time => `Runs Monday–Friday at ${time}`,
        weekly: (day, time) => `Runs every ${day} at ${time}`,
        monthly: (day, time) => `Runs on day ${day} of each month at ${time}`,
        interval: (count, unit) =>
          `Runs every ${count} ${unit === 'm' ? 'minute(s)' : unit === 'd' ? 'day(s)' : 'hour(s)'}`,
        cap: count => `, ${count} time(s) total`,
        raw: 'Raw schedule — every Nm/Nh/Nd or 5-field cron'
      },
      units: {
        minutesFromNow: 'minutes from now',
        hoursFromNow: 'hours from now',
        daysFromNow: 'days from now',
        minutes: 'minutes',
        hours: 'hours',
        days: 'days'
      },
      dayOfMonth: 'Day of month',
      repeat: 'Repeat',
      time: 'Time',
      weekday: 'Day of week',
      delay: 'Run in',
      interval: 'Every',
      amount: 'Amount',
      unit: 'Unit',
      customSchedule: 'Schedule',
      customScheduleHint: 'Use an interval such as every 2h, or a cron expression such as 0 9 * * *.',
      runLimit: 'Run limit',
      unlimited: 'No limit',
      limited: 'Set a limit',
      runCount: 'Number of runs',
      scheduled: title => `Cronjob "${title}" scheduled`,
      newTitle: 'New routine',
      newSubtitle: 'Runs appear in the agent’s history.',
      namePlaceholder: 'Name this routine',
      instruction: 'Instructions',
      instructionPlaceholder: 'What should the agent do each time this routine runs?',
      continuity: 'Use the previous result',
      continuityHint: 'Each run receives the result of the previous one.',
      scheduling: 'Scheduling…',
      create: 'Create routine',
      staleNotice: 'Could not refresh cronjobs. Showing the last list we had.',
      paneTitle: 'Cronjobs',
      loadFailed: 'Could not load cronjobs. The list may still be there.',
      createForBot: 'Create a cronjob for this bot'
    },
    groups: {
      you: 'You',
      aBot: 'A bot',
      didSomething: 'did something',
      activity: {
        queued: 'sent a message',
        working: 'is working…',
        replied: 'replied',
        passed: 'passed',
        'timed-out': 'took too long',
        failed: 'hit an error',
        cancelled: 'turn interrupted by a newer message',
        settled: 'turn settled',
        delivered: 'delivered a late reply'
      },
      nameTaken: name => `A group named “${name}” already exists.`,
      added: (bot, group) => `${bot} added to “${group}”`,
      removed: (bot, group) => `${bot} removed from “${group}”`,
      manageTitle: 'Manage groups',
      manageSubtitle: 'A bot can join multiple group chats. Memberships sync to every machine.',
      newGroupPlaceholder: 'New group…',
      firstGroupPlaceholder: 'Group name (e.g. Research)',
      createAndJoin: 'Create & join',
      removeFromAll: 'Remove from all groups',
      pictureFailed: 'Group picture generation failed',
      settingsTitle: 'Group settings',
      settingsSubtitle: 'Rename the group or set a room picture. Members and history are kept.',
      nameLabel: 'Group name',
      created: (name, count) => `“${name}” created with ${count} bots`,
      createTitle: 'New Group Chat',
      createSubtitle: max =>
        `Pick 2–${max} bots. Local memberships sync through each Bot profile; cross-machine members stay scoped to this room.`,
      searchLabel: 'Search bots to add',
      searchPlaceholder: 'Search bots to add…',
      removeFromSelection: 'Remove from selection',
      memberIn: (handle, groups) => `@${handle} · in ${groups}`,
      noBots: 'No bots yet — create agents first.',
      pickAtLeast: 'Pick at least 2 bots',
      createButton: count => `Create Group${count ? ` (${count})` : ''}`,
      everyBot: 'Every bot in the room',
      botCount: count => `${count} bots`,
      settingsTooltip: group => `Group settings — rename ${group} or set a room picture`,
      disbandTooltip: group => `Disband the ${group} group chat`,
      hideActivity: 'Hide room activity',
      showActivity: 'Show room activity',
      activityTitle: 'Activity',
      noActivity: 'No activity in this turn yet.',
      image: 'image',
      removeAttachment: 'Remove attachment',
      attachFiles: 'Attach files — every responding bot sees them',
      attachedFile: 'attached file',
      attachedImage: 'attached image',
      hideHandle: 'Hide full handle',
      showHandle: 'Show full handle',
      blockToday: time => `Today, ${time}`,
      blockYesterday: time => `Yesterday, ${time}`,
      blockDate: (date, time) => `${date}, ${time}`,
      dropToAttach: 'Drop to attach — every responding bot sees it',
      emptyRoom: 'Say something — every bot in this group hears the room.',
      noRoomTitle: 'No group open',
      noRoomDescription: 'Pick a group in WorkBots to open its conversation.',
      thinking: name => `${name} is thinking…`,
      roomWorking: 'The room is working…',
      messageLabel: group => `Message ${group}`,
      composerPlaceholder: group => `Message ${group}… (@name to direct, @everyone for all)`,
      send: 'Send',
      disbandTitle: 'Disband group chat?',
      disbandBodyStart: 'This removes the ',
      disbandBodyMiddle: count =>
        ` grouping from its ${count} bots and clears the shared room log. The bots themselves and their “Group: `,
      disbandBodyEnd: '” sessions are kept — you can still open those from each bot’s session browser.',
      disband: 'Disband',
      disbanding: 'Disbanding…',
      disbanded: 'Disbanded',
      disbandedNotice: group => `Disbanded “${group}”`,
      noMessagesRoom: 'No messages yet — say hi to the room',
      needsInput: 'A bot in this room needs your input',
      needsYou: 'needs you'
    },
    mentions: {
      meta: (name, source) => `Bot · ${name}${source}`
    },
    palette: {
      newAgent: 'New Agent…',
      newAgentHint: 'Open the Bots pane and hit “New Agent”.'
    },
    guard: {
      title: 'This chat never resets',
      message:
        'Bot chats are one continuous conversation — compacting instead. For a throwaway session with this agent, use Sessions mode.'
    }
  },
  pt: {
    common: {
      back: 'Voltar',
      cancel: 'Cancelar',
      description: 'Descrição',
      generate: 'Gerar',
      generating: 'Gerando…',
      name: 'Nome',
      remove: 'Remover',
      retry: 'Tentar novamente',
      save: 'Salvar',
      saving: 'Salvando…',
      title: 'Título',
      upload: 'Enviar'
    },
    notify: {
      newMessage: label => `🤖 Nova mensagem para ${label}`,
      newActivity: label => `${label} tem atividade nova`,
      openToSee: 'Abra a conversa para ver.'
    },
    roster: {
      copyTitle: title => `${title} (cópia)`,
      noFreeName: 'Não há nome livre para a cópia.',
      deleteFailed: name => `Não foi possível excluir o perfil ${name}.`,
      noConversations: 'Nenhuma conversa ainda — diga oi',
      openFailed: name => `Não foi possível abrir a conversa de ${name} — tente novamente`,
      pinned: 'Fixado',
      hiddenFromRoster: 'Oculto da lista',
      livesOn: label => `Roda em ${label}`,
      unread: 'não lido',
      activeRecently: 'Ativo nos últimos 90 s',
      lastFromBot: handle => `A última mensagem veio de @${handle} (de bot para bot)`,
      pinnedToTop: name => `${name} fixado no topo`,
      unpinned: name => `${name} desafixado`,
      backInRoster: name => `${name} voltou para a lista`,
      hiddenNotice: name => `${name} ocultado — use o botão de olho no cabeçalho do WorkBots para ver os bots ocultos`,
      duplicating: name => `Duplicando ${name}…`,
      duplicated: (name, source) => `${name} criado — cópia completa de ${source}`,
      duplicateFailed: 'Falha ao duplicar',
      menu: {
        pin: 'Fixar no topo',
        unpin: 'Desafixar',
        hide: 'Ocultar bot',
        unhide: 'Mostrar bot',
        sessions: 'Sessões',
        editProfile: 'Editar perfil',
        groups: groups => `Grupos: ${groups}…`,
        manageGroups: 'Gerenciar grupos…',
        duplicate: 'Duplicar',
        newChat: 'Nova conversa com este agente',
        delete: 'Excluir'
      },
      activeNow: 'Ativos agora',
      openChat: label => `Abrir a conversa de ${label}`,
      staleNotice: 'Falha ao atualizar a lista — mostrando a última lista válida.',
      waitingReconnect: ' Aguardando o gateway reconectar…',
      toastsOn: 'Avisos de atividade ativados — clique para silenciar',
      toastsOff: 'Avisos de atividade desativados — clique para ativar',
      hideHiddenAgain: 'Ocultar de novo os bots ocultos',
      showHiddenCount: count => `Mostrar ${count} ${count === 1 ? 'bot oculto' : 'bots ocultos'}`,
      hideHidden: 'Ocultar bots ocultos',
      showHidden: 'Mostrar bots ocultos',
      hiddenUnread: 'um bot oculto tem atividade não lida',
      newMenu: 'Novo…',
      newMenuLabel: 'Novo agente ou conversa em grupo',
      newAgent: 'Novo agente',
      newGroupChat: 'Nova conversa em grupo',
      searchLabel: 'Buscar bots',
      searchBots: 'Buscar bots…',
      unavailable: reason =>
        `Lista indisponível: ${reason}. Se o seu gateway for anterior ao profiles.list, atualize o Work4You e reinicie o gateway.`,
      gatewayError: 'erro do gateway',
      waitingConnection:
        'Aguardando a conexão com o gateway… (gateways remotos podem levar alguns segundos; nova tentativa automática)',
      retryNow: 'Tentar agora',
      emptyTitle: 'Nenhum agente ainda',
      emptyDescription: 'Crie seu primeiro colega de equipe.',
      noMatch: query => `Nenhum bot corresponde a “${query}”`,
      allHidden: 'Todos os bots estão ocultos — use o botão de olho acima para mostrá-los.',
      deleteDialog: {
        title: 'Excluir bot e perfil?',
        bodyStart: 'Isso vai excluir permanentemente o bot ',
        bodyMiddle: ' e o perfil do Work4You associado a ele, em ',
        bodyEnd: '. Não é possível desfazer.',
        confirm: 'Excluir',
        busy: 'Excluindo…',
        done: 'Excluído'
      },
      deleted: name => `Perfil ${name} excluído`
    },
    remote: {
      noSession: 'Nenhuma sessão remota',
      messaged: (handle, label) => `Mensagem enviada para @${handle} em ${label} — a resposta será repassada aqui.`,
      noReply: (handle, label) => `@${handle} ainda não respondeu — confira o Bot Chat dele em ${label}.`,
      reachFailed: label => `Não foi possível acessar ${label}`,
      remoteSource: 'a origem remota',
      updateDesktop: 'Atualize o Work4You Desktop para conversar com agentes de outras conexões.',
      stillOn: (current, target) => `Ainda em ${current}, não em ${target}`,
      thisDevice: 'este dispositivo',
      stayInChat: handle =>
        `Continue nesta conversa e use @${handle} para mandar mensagem. O gateway continua neste dispositivo.`
    },
    sessions: {
      cannotOpenStored: 'Esta versão do Work4You Desktop não consegue abrir sessões salvas',
      openFailed: 'Não foi possível abrir a sessão',
      untitled: 'Sessão sem título',
      noMessages: 'Nenhuma mensagem ainda',
      title: name => `Sessões de ${name}`,
      filterLabel: 'Filtrar sessões',
      filterPlaceholder: 'Filtrar sessões…',
      showingRecent: count => `Mostrando as ${count} sessões mais recentes.`,
      loadFailed: 'Não foi possível carregar as sessões deste perfil.',
      noMatchRecent: count => `Nenhuma sessão corresponde ao filtro entre as ${count} mais recentes.`,
      noMatch: 'Nenhuma sessão corresponde a esse filtro.',
      empty: 'Nenhuma sessão salva ainda.',
      conversation: 'Conversa'
    },
    avatar: {
      tabs: { bot: 'Bot', generate: 'Gerar', upload: 'Enviar', pet: 'Pet' },
      imageTooLarge: 'Imagem grande demais (máx. 15MB).',
      generationFailed: 'falha na geração',
      generateFailed: 'Falha ao gerar o avatar',
      removeImage: 'Remover imagem — usar forma',
      // "Auto", as in English: the label sits in a 44px cell; the hint spells it out.
      blobAuto: 'Auto',
      blobAutoHint: 'Automático — o nome decide',
      randomize: 'Sortear',
      unlockHint: 'Destravar — o rosto volta a seguir o nome do agente',
      lockHint: 'Manter exatamente este rosto mesmo que o nome mude',
      unlock: 'Destravar',
      lockFace: 'Travar rosto',
      faceLocked: 'Rosto travado — renomear não vai alterá-lo.',
      faceFollowsName: 'O rosto segue o nome.',
      classicShapes: 'Formas clássicas',
      blobFace: 'Rosto de bolha — definido pelo nome do agente',
      describe: 'Descreva seu avatar…',
      generateHint: 'Deixe em branco para gerar a partir do nome e da descrição do agente.',
      noImageModel:
        'Nenhum modelo de imagem disponível. Se você acabou de ativar um (ou atualizou o Work4You), reinicie o gateway: Ctrl+K → "Reiniciar gateway".',
      checkingImageModel: 'Verificando o backend de imagem…',
      chooseImage: 'Escolher uma imagem…',
      noPets: 'Nenhum pet na galeria do petdex. Execute `work4you pets` para explorar.',
      petPick: 'Escolha um pet como foto de perfil deste agente.',
      petSearch: count => `Buscar entre ${count} pets…`,
      removePet: 'Remover — voltar ao avatar de forma',
      noPetsMatch: 'Nenhum pet encontrado.',
      petFailed: 'Não foi possível carregar esse pet — tente outro.',
      scrollMore: (shown, total) => `Role para ver mais (${shown} de ${total})`
    },
    attachments: {
      tooLarge: name => `${name}: grande demais (máx. 15MB).`,
      unnamed: 'anexo'
    },
    mcp: {
      addFailed: 'Não foi possível adicionar o servidor',
      noProfile: 'Nenhum perfil de destino',
      setKeyFailed: key => `Falha ao definir ${key}`,
      configured: name => `${name} configurado`,
      testFailed: 'O teste do servidor falhou após a configuração',
      oauthStartFailed: 'Não foi possível iniciar o OAuth',
      completeSignIn: 'Conclua o login no navegador...',
      authenticated: name => `${name} autenticado`,
      oauthFailed: 'Falha no OAuth',
      needsSetup: keys => `precisa de configuração (${keys}) — reinicie o gateway para ativar a configuração no app`,
      setUpDone: 'configurado ✓',
      saveAndTest: 'Salvar e testar',
      authorizing: 'Autorizando…',
      working: 'Processando…',
      setupFailed: 'Falha na configuração',
      retry: 'tentar novamente',
      signIn: 'Entrar…',
      setUp: 'Configurar…'
    },
    model: {
      gatewayDefault: 'padrão do gateway',
      namePlaceholder: 'ex.: nome do modelo',
      provider: 'Provedor',
      model: 'Modelo',
      providerCustom: 'Provedor (personalizado)',
      modelCustom: 'Modelo (personalizado)',
      providerExample: 'ex.: omnirouter, inferx, 9router',
      modelExample: 'ex.: antigravity/gemini-3.6-flash-high',
      backToDropdowns: '← Voltar às listas',
      inherit: 'Herdar (perfil de inicialização)',
      enterManually: '✏️ Digitar manualmente…',
      proNeedsSubscription: 'Os modelos Pro exigem uma assinatura paga do Work4You.'
    },
    config: {
      needsNewerGateway:
        'A configuração completa exige um gateway mais recente (reinicie-o depois de atualizar o Work4You).',
      capabilities: 'Capacidades (aplicadas na hora — skills, ferramentas, MCP)',
      soul: 'SOUL.md (persona + protocolo de mensagens entre agentes)',
      skills: (enabled, total) => `Skills (${enabled}/${total} ativadas)`,
      filterSkills: 'Filtrar skills…',
      toolsets: (enabled, total) =>
        `Conjuntos de ferramentas (${enabled}/${total} ativados — desmarcar todos restaura o padrão)`,
      mcpServers: 'Servidores MCP',
      noMcp: 'Nenhum servidor MCP configurado ou no catálogo.',
      catalogInstalled: 'catálogo · instalado',
      catalog: 'catálogo'
    },
    hub: {
      installed: name => `Skill "${name}" instalada`,
      installFailed: name => `Falha ao instalar "${name}"`,
      title: 'Hub de Skills',
      hideBrowser: 'ocultar o navegador do hub',
      browseFull: 'navegar pelo hub completo ▾',
      frameTitle: 'Hub de Skills do Work4You',
      installing: name => `Instalando "${name}"…`,
      pickerHint:
        'Clique em "+ Add to this Agent" em qualquer skill — ela é instalada e aparece na lista acima. Arraste o canto para redimensionar.',
      searchPlaceholder: 'Buscar no hub (comunidade + fontes conhecidas)…',
      searching: 'Buscando…',
      search: 'Buscar',
      searchingHint: 'Buscando na comunidade e em fontes conhecidas — pode levar uns 10 s…',
      noResults: 'Nenhuma skill do hub encontrada.',
      added: '✓ adicionada',
      installTitle: name => `Instalar "${name}" e adicioná-la à lista acima`
    },
    edit: {
      lookRemoteFailed: 'Aparência salva localmente; falha ao salvar no servidor',
      descriptionFailed: 'Aparência salva localmente; falha ao atualizar a descrição',
      sectionsFailed: sections => `Algumas seções falharam: ${sections}`,
      advancedFailed: 'Falha na configuração avançada',
      updated: name => `${name} atualizado`,
      title: 'Editar perfil',
      subtitle: (name, profile) => `Aparência e função de ${name} (${profile}).`,
      descriptionPlaceholder: 'Em que este agente deve ajudar?',
      advanced: 'Avançado — modelo, skills, conjuntos de ferramentas, SOUL.md'
    },
    create: {
      retry: 'Tentar novamente',
      instructionsPlaceholder: 'Deixe em branco para usar as instruções automáticas.',
      instructionsHint: 'Substitui as instruções geradas a partir do nome, título e descrição.',
      instructions: 'Instruções do agente (opcional)',
      appearanceHint: 'A aparência deste agente em todo o app.',
      startCopy: 'Copiar de',
      startFresh: 'Do zero',
      startFrom: 'Ponto de partida',
      capabilitiesHint: 'Skills, MCP e Plugins',
      customizeCapabilities: 'Personalizar capacidades',
      capabilitiesDescription: 'Escolha o que este agente pode fazer.',
      settingsDescription: 'Ajuste como este agente vai trabalhar.',
      settingsHint: 'Modelo e instruções',
      settingsTitle: 'Configurações do agente',
      settings: 'Configurações',
      back: 'Voltar ao agente',
      draftDiscarded: name => `Rascunho do agente "${name}" descartado`,
      draftCleanupFailed: name => `Não foi possível remover o perfil de rascunho "${name}"`,
      failed: 'Não foi possível criar o agente.',
      createdOn: (name, target) => `Agente "${name}" criado em ${target}`,
      created: name => `Agente "${name}" criado`,
      title: 'Novo agente',
      subtitle: 'Escolha a aparência e como este agente vai trabalhar.',
      namePlaceholder: 'assistente-de-pesquisa',
      takenOn: (slug, target) => `Já existe um agente chamado "${slug}" em ${target}.`,
      taken: slug => `Já existe um agente chamado "${slug}".`,
      createOn: 'Criar em',
      current: label => `${label} (atual)`,
      remoteHint: target =>
        `O agente é criado em ${target} e aparece na lista como um bot de outra conexão. A conversa é encaminhada para essa máquina.`,
      titlePlaceholder: 'Assistente de pesquisa',
      descriptionPlaceholder: 'Em que este bot deve ajudar?',
      advanced: 'Avançado',
      tabs: { general: 'Geral', capabilities: 'Capacidades', skills: 'Skills', toolsets: 'Ferramentas', mcp: 'MCP' },
      profileNotReady: 'Ainda não foi possível criar o perfil',
      cloneFromOn: target => `Clonar do perfil (em ${target})`,
      cloneFrom: 'Clonar do perfil',
      fresh: 'Perfil novo (skills incluídas)',
      soulLabel: 'SOUL.md (opcional — substitui a persona gerada)',
      soulPlaceholder:
        'Deixe em branco para gerar automaticamente a partir de nome/título/descrição + lista de agentes para mensagens.',
      shareAuth: 'Compartilhar logins OAuth com o perfil principal',
      shareAuthHint:
        'Os logins OAuth ficam compartilhados (não copiados), assim renovar um token nunca invalida o do outro perfil. Desmarque para ter uma cópia isolada da autenticação. Um perfil novo não copia o .env nem o WhatsApp do perfil principal — clone um perfil para copiá-los.',
      noSkills: 'Criar vazio (sem as skills incluídas)',
      nameTaken: 'Esse nome já está em uso — escolha outro antes de configurar as capacidades.',
      nameFirst: 'Dê um nome ao agente antes de personalizar as capacidades.',
      catalogNeedsGateway:
        'O catálogo de capacidades exige um gateway mais recente (reinicie-o depois de atualizar o Work4You).',
      noSkillsChecked: '“Criar vazio” está marcado — nenhuma skill incluída será instalada.',
      freshSkillsHint:
        'Perfil novo — as skills incluídas são instaladas depois da criação. Abra Capacidades depois de dar um nome ao agente para editar o catálogo real, ou clone um perfil para ver as skills dele aqui.',
      catalogFrom: source => `Catálogo de ${source} — as skills desmarcadas são desativadas depois da criação.`,
      toolsetsHint: 'Deixar todos (ou nenhum) marcados mantém o comportamento padrão dos conjuntos de ferramentas.',
      mcpHint:
        'Os servidores configurados são copiados do perfil principal; os itens do catálogo são o menu MCP incluído. Itens que precisam de chaves de API passam primeiro pela configuração (as credenciais seguem a opção de chaves compartilhadas).',
      creating: 'Criando…',
      submit: 'Criar agente',
      canonicalKickoff: 'Oi! Apresente-se — quem você é e como pode ajudar.'
    },
    routines: {
      untitled: 'Tarefa sem título',
      filterHint:
        'Este perfil tem tarefas agendadas, mas nenhuma está marcada para este bot. Dê a uma tarefa o nome "[bot:<nome>] …" para mostrá-la aqui, ou veja todas em Cron abaixo.',
      nameNul: 'O nome da tarefa não pode conter NUL (U+0000).',
      instructionNul: 'A instrução da tarefa não pode conter NUL (U+0000).',
      schedule: {
        once: when => `Uma vez (${when})`,
        daily: 'Diariamente',
        everyDays: count => `A cada ${count} dias`,
        hourly: 'A cada hora',
        everyHours: count => `A cada ${count}h`,
        everyMinutes: count => `A cada ${count} min`
      },
      updateFailed: 'Falha ao atualizar a tarefa agendada',
      delete: 'Excluir tarefa agendada',
      next: when => `próxima ${when}`,
      paused: 'pausada',
      legacyPaused: 'Pausada por segurança: exclua e recrie esta tarefa antiga antes de executá-la de novo.',
      frequency: {
        once: 'Uma vez, daqui a…',
        hourly: 'A cada hora',
        daily: 'Todos os dias',
        weekdays: 'Dias úteis',
        weekly: 'Toda semana',
        monthly: 'Todo mês',
        interval: 'Intervalo',
        advanced: 'Avançado…'
      },
      weekdays: {
        monday: 'Segunda-feira',
        tuesday: 'Terça-feira',
        wednesday: 'Quarta-feira',
        thursday: 'Quinta-feira',
        friday: 'Sexta-feira',
        saturday: 'Sábado',
        sunday: 'Domingo'
      },
      timeOfDay: (hour, minute) => `${hour}:${String(minute).padStart(2, '0')}`,
      summary: {
        once: (count, unit) =>
          `Executa uma vez, daqui a ${count} ${unit === 'm' ? 'minuto' : unit === 'd' ? 'dia' : 'hora'}${count === 1 ? '' : 's'}`,
        hourly: 'Executa no início de cada hora',
        daily: time => `Executa todos os dias às ${time}`,
        weekdays: time => `Executa de segunda a sexta às ${time}`,
        weekly: (day, time) =>
          `Executa ${/^(sábado|domingo)$/i.test(day) ? 'todo' : 'toda'} ${day.toLowerCase()} às ${time}`,
        monthly: (day, time) => `Executa no dia ${day} de cada mês às ${time}`,
        interval: (count, unit) =>
          `Executa a cada ${count} ${unit === 'm' ? 'minuto' : unit === 'd' ? 'dia' : 'hora'}${count === 1 ? '' : 's'}`,
        cap: count => `, ${count} ${count === 1 ? 'vez' : 'vezes'} no total`,
        raw: 'Agendamento livre — every Nm/Nh/Nd ou cron de 5 campos'
      },
      units: {
        minutesFromNow: 'minutos a partir de agora',
        hoursFromNow: 'horas a partir de agora',
        daysFromNow: 'dias a partir de agora',
        minutes: 'minutos',
        hours: 'horas',
        days: 'dias'
      },
      dayOfMonth: 'Dia do mês',
      repeat: 'Repetir',
      time: 'Horário',
      weekday: 'Dia da semana',
      delay: 'Executar em',
      interval: 'A cada',
      amount: 'Quantidade',
      unit: 'Unidade',
      customSchedule: 'Agendamento',
      customScheduleHint: 'Use um intervalo como every 2h ou uma expressão cron como 0 9 * * *.',
      runLimit: 'Limite de execuções',
      unlimited: 'Sem limite',
      limited: 'Definir limite',
      runCount: 'Número de execuções',
      scheduled: title => `Tarefa "${title}" agendada`,
      newTitle: 'Nova rotina',
      newSubtitle: 'Execuções no histórico do agente.',
      namePlaceholder: 'Dê um nome a esta rotina',
      instruction: 'Instruções',
      instructionPlaceholder: 'O que o agente deve fazer a cada execução desta rotina?',
      continuity: 'Usar o resultado anterior',
      continuityHint: 'Cada execução recebe o resultado da anterior.',
      scheduling: 'Agendando…',
      create: 'Criar rotina',
      staleNotice: 'Não foi possível atualizar as tarefas agendadas. Mostrando a última lista disponível.',
      paneTitle: 'Tarefas agendadas',
      loadFailed: 'Não foi possível carregar as tarefas agendadas. A lista pode continuar lá.',
      createForBot: 'Criar uma tarefa agendada para este bot'
    },
    groups: {
      you: 'Você',
      aBot: 'Um bot',
      didSomething: 'fez algo',
      activity: {
        queued: 'enviou uma mensagem',
        working: 'está trabalhando…',
        replied: 'respondeu',
        passed: 'passou a vez',
        'timed-out': 'demorou demais',
        failed: 'encontrou um erro',
        cancelled: 'turno interrompido por uma mensagem mais nova',
        settled: 'turno encerrado',
        delivered: 'entregou uma resposta atrasada'
      },
      nameTaken: name => `Já existe um grupo chamado “${name}”.`,
      added: (bot, group) => `${bot} adicionado a “${group}”`,
      removed: (bot, group) => `${bot} removido de “${group}”`,
      manageTitle: 'Gerenciar grupos',
      manageSubtitle:
        'Um bot pode participar de várias conversas em grupo. As participações são sincronizadas em todas as máquinas.',
      newGroupPlaceholder: 'Novo grupo…',
      firstGroupPlaceholder: 'Nome do grupo (ex.: Pesquisa)',
      createAndJoin: 'Criar e entrar',
      removeFromAll: 'Remover de todos os grupos',
      pictureFailed: 'Falha ao gerar a imagem do grupo',
      settingsTitle: 'Configurações do grupo',
      settingsSubtitle: 'Renomeie o grupo ou defina uma imagem para a sala. Os membros e o histórico são mantidos.',
      nameLabel: 'Nome do grupo',
      created: (name, count) => `“${name}” criado com ${count} bots`,
      createTitle: 'Nova conversa em grupo',
      createSubtitle: max =>
        `Escolha de 2 a ${max} bots. As participações locais são sincronizadas pelo perfil de cada bot; membros de outras máquinas ficam restritos a esta sala.`,
      searchLabel: 'Buscar bots para adicionar',
      searchPlaceholder: 'Buscar bots para adicionar…',
      removeFromSelection: 'Remover da seleção',
      memberIn: (handle, groups) => `@${handle} · em ${groups}`,
      noBots: 'Nenhum bot ainda — crie agentes primeiro.',
      pickAtLeast: 'Escolha pelo menos 2 bots',
      createButton: count => `Criar grupo${count ? ` (${count})` : ''}`,
      everyBot: 'Todos os bots da sala',
      botCount: count => `${count} ${count === 1 ? 'bot' : 'bots'}`,
      settingsTooltip: group => `Configurações do grupo — renomeie ${group} ou defina uma imagem para a sala`,
      disbandTooltip: group => `Dissolver a conversa em grupo ${group}`,
      hideActivity: 'Ocultar atividade da sala',
      showActivity: 'Mostrar atividade da sala',
      activityTitle: 'Atividade',
      noActivity: 'Nenhuma atividade neste turno ainda.',
      image: 'imagem',
      removeAttachment: 'Remover anexo',
      attachFiles: 'Anexar arquivos — todos os bots que responderem vão vê-los',
      attachedFile: 'arquivo anexado',
      attachedImage: 'imagem anexada',
      hideHandle: 'Ocultar identificador completo',
      showHandle: 'Mostrar identificador completo',
      blockToday: time => `Hoje, ${time}`,
      blockYesterday: time => `Ontem, ${time}`,
      blockDate: (date, time) => `${date}, ${time}`,
      dropToAttach: 'Solte para anexar — todos os bots que responderem vão ver',
      emptyRoom: 'Diga algo — todos os bots deste grupo ouvem a sala.',
      noRoomTitle: 'Nenhum grupo aberto',
      noRoomDescription: 'Escolha um grupo no WorkBots para abrir a conversa.',
      thinking: name => `${name} está pensando…`,
      roomWorking: 'A sala está trabalhando…',
      messageLabel: group => `Mensagem para ${group}`,
      composerPlaceholder: group => `Mensagem para ${group}… (@nome para direcionar, @everyone para todos)`,
      send: 'Enviar',
      disbandTitle: 'Dissolver a conversa em grupo?',
      disbandBodyStart: 'Isso remove o agrupamento ',
      disbandBodyMiddle: count =>
        ` dos ${count} bots e limpa o histórico compartilhado da sala. Os próprios bots e as sessões “Group: `,
      disbandBodyEnd: '” deles continuam — você ainda pode abri-las no navegador de sessões de cada bot.',
      disband: 'Dissolver',
      disbanding: 'Dissolvendo…',
      disbanded: 'Dissolvido',
      disbandedNotice: group => `“${group}” dissolvido`,
      noMessagesRoom: 'Nenhuma mensagem ainda — diga oi para a sala',
      needsInput: 'Um bot nesta sala precisa da sua resposta',
      needsYou: 'precisa de você'
    },
    mentions: {
      meta: (name, source) => `Bot · ${name}${source}`
    },
    palette: {
      newAgent: 'Novo agente…',
      newAgentHint: 'Abra o painel WorkBots e clique em “Novo agente”.'
    },
    guard: {
      title: 'Esta conversa nunca é reiniciada',
      message:
        'A conversa com um bot é contínua — compactando em vez de reiniciar. Para uma sessão descartável com este agente, use o modo Sessões.'
    }
  }
}

function botModeEnglish(key, args) {
  const value = key
    .split('.')
    .reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), BOT_MODE_LOCALES.en)

  return typeof value === 'function' ? value(...args) : typeof value === 'string' ? value : key
}

/** Translator for code outside React: the active language when the host
 *  offers plugin i18n, else English (older SDKs, the vm test harness). */
function tr(key, ...args) {
  return pluginCtx?.i18n?.t ? pluginCtx.i18n.t(key, ...args) : botModeEnglish(key, args)
}

/** Translator hook for components: re-renders on a language switch. */
const useBotModeT =
  typeof sdk !== 'undefined' && typeof sdk.usePluginI18n === 'function' ? () => sdk.usePluginI18n(ID) : () => tr

/** Live roster snapshot for imperative handlers (context menus). */
const $lastRoster = atom([])

/** Bots with chat activity the user hasn't seen yet (name -> true).
 *  Fed by the roster poll's activity watermark, so it catches EVERY
 *  delivery path: RPC, CLI (bot-to-bot), cron runs, other machines. */
const $botUnread = atom({})

// last_active watermark per bot, seeded on first poll so a fresh mount
// doesn't mark ancient history unread.
const rosterWatermarks = new Map()
let watermarksSeeded = false

/** User pref: toast on every new bot activity. Default OFF — a busy roster
 *  (cron runs, bot-to-bot chatter) turns the toasts into a firehose, and the
 *  unread badge already carries the signal. Persisted via ctx.storage. */
const $activityToasts = atom(false)

/** Flip the activity-toast pref and persist it. */
function setActivityToasts(enabled) {
  $activityToasts.set(enabled)

  try {
    Promise.resolve(pluginCtx?.storage?.set?.('activity-toasts', enabled)).catch(() => undefined)
  } catch {
    /* storage unavailable — pref holds for this window only */
  }
}

/** Detect new inbound activity from a fresh roster: last_active moved past
 *  the watermark for a bot whose chat isn't on screen -> unread + toast.
 *  Watermarks follow botActivitySession (canonical Bot Chat included) —
 *  last_session alone never sees the hidden Bot Chat, so DMs delivered
 *  there would neither badge nor toast. */
function trackInboundActivity(roster) {
  const seeding = !watermarksSeeded
  watermarksSeeded = true

  for (const bot of roster) {
    const activity = botActivitySession(bot)
    const ts = activity?.last_active || 0
    const prev = rosterWatermarks.get(bot.name) || 0
    rosterWatermarks.set(bot.name, Math.max(prev, ts))

    if (seeding || ts <= prev) {
      continue
    }

    // Activity in the bot the user is currently looking at is already
    // visible — never badge the open chat.
    if ($selectedBot.get() === bot.name) {
      continue
    }

    $botUnread.set({ ...$botUnread.get(), [bot.name]: true })

    // Roster-hidden bots stay quiet: the unread flag above accumulates
    // silently (unhiding reveals the badge) but a hidden bot never toasts.
    if ($botMeta.get()[bot.name]?.hidden) {
      continue
    }

    // Toasts are opt-in: the unread badge is always set above, but the
    // per-message notification fires only when the user enabled it.
    if ($activityToasts.get()) {
      const meta = $botMeta.get()[bot.name]
      const label = displayName(bot, meta)
      const preview = (activity?.preview || '').trim()
      const inbound = /^Message from/i.test(preview)

      host.notify({
        kind: 'info',
        title: inbound ? tr('notify.newMessage', label) : tr('notify.newActivity', label),
        message: preview.slice(0, 140) || tr('notify.openToSee')
      })
    }
  }
}

/** Last good cron list, same idea as the roster snapshot. */
const $lastJobs = atom([])

// Bot Mode sessions are ALWAYS hidden from the global Sessions sidebar:
// canonical Bot Chats are plugin-owned forever-chats and group-chat member
// sessions are room plumbing — neither is a scratch conversation, and a
// 6-member room would otherwise dump six identical "Group: ..." rows into
// recents. Backed by the core generic `hidden` session flag (session.create
// hidden:true / session.set_hidden); the Bots pane browses them via
// session.list include_hidden. Older gateways ignore the flag and the
// sessions simply stay visible there.

/** Bot the Routines tile is scoped to. Follows the live gateway profile
 *  (the bot you're actually chatting with) and roster clicks. */
const $selectedBot = atom('default')

/** Owner profile of the chat the user is LOOKING AT. Newer desktops expose
 *  `host.state.focusedSessionProfile` (the focused session row's stamped
 *  owner, gateway profile for drafts); older builds fall back to the gateway
 *  profile atom — the socket's home — which is the previous behavior. The
 *  distinction matters because tab/tile focus moves WITHOUT swapping the
 *  gateway socket: with only the socket atom, opening another bot's chat in
 *  a tab left the roster highlight (and the Cronjobs tile) on whichever bot
 *  the socket happened to be homed on. */
const $focusedBotProfile = host.state.focusedSessionProfile || host.state.profile

/** Optional secondary navigation inside the Bots pane. Primary row clicks still
 * open the bot's canonical chat; this state opens its stored-session browser. */
const $botSessionsWorkspace = atom(null)
const $botSelectedSessions = atom({})
const $sessionsGatewayGeneration = atom(0)

/** Group-chat rooms: { [group]: { log: [{from:{kind,name},text,at}], watermarks:{[member]:idx}, epoch, running } }.
 *  Log + watermarks persist via plugin storage; epoch/running are runtime-only. */
const $groupChats = atom({})
/** The selected group chat: the room the center page shows (on desktops
 *  without plugin pages, the room the Bots pane swaps in). Outlives a trip to
 *  a bot's chat, so coming back to the page reopens the same room. */
const $groupChatWorkspace = atom(null)
/** Room views mounted right now. The roster lights a group row only while its
 *  room is actually on screen — not merely selected. */
const $groupRoomViews = atom(0)
/** Groups whose latest room activity mentions @user — the needs-you badge. */
const $groupNeedsYou = atom({})

// ── group activity feed ─────────────────────────────────────────────────────
// Runtime-only, bounded per-room record of turn events that feeds the
// collapsible Activity view. Never persisted — it is presentation state like
// running/epoch, and the room transcript (log) stays the only durable record.
// Every event is tagged with the room epoch it belongs to, so the view shows
// only the CURRENT run: a newer send bumps the epoch (old-run events drop
// away), and a rename re-keys the room (the feed starts clean under the new
// name — stale events under the old key simply have no room to attach to).
const GROUP_ACTIVITY_LIMIT = 50
const $groupActivity = atom({})

function recordGroupActivity(group, event) {
  const room = $groupChats.get()[group]

  if (!room) {
    return null
  }

  const current = $groupActivity.get()[group] || { events: [] }
  const entry = { at: Date.now(), epoch: room.epoch || 0, ...event }
  const events = [...current.events, entry].slice(-GROUP_ACTIVITY_LIMIT)
  $groupActivity.set({ ...$groupActivity.get(), [group]: { ...current, events } })

  return entry
}

/** Events for the room's CURRENT run — superseded runs (epoch moved on)
 *  are dropped from view instead of describing work that already ended. */
function currentGroupActivity(group) {
  const epoch = ($groupChats.get()[group] || {}).epoch || 0
  return ($groupActivity.get()[group] || {}).events?.filter(event => (event.epoch || 0) === epoch) || []
}

/** Human label for one activity event, used by the collapsed summary and
 *  the expanded rows. Components pass their reactive `t`; the labels live
 *  in BOT_MODE_LOCALES (groups.activity). `member: 'You'` is the room's
 *  stored identity for the user, not display copy. */
function groupActivityLabel(event, t = tr) {
  const kind = event?.kind
  const known = Boolean(kind) && Object.prototype.hasOwnProperty.call(BOT_MODE_LOCALES.en.groups.activity, kind)
  const base = known ? t(`groups.activity.${kind}`) : kind || t('groups.didSomething')

  if (kind === 'cancelled' || kind === 'settled') {
    return base
  }

  const who = event?.member === 'You' ? t('groups.you') : groupSpeakerLabel(event?.member || t('groups.aBot'))

  return `${who} ${base}`
}

const GROUP_ACTIVITY_GLYPHS = {
  queued: 'comment',
  working: 'sync',
  replied: 'check',
  passed: 'circle-outline',
  'timed-out': 'clock',
  failed: 'error',
  cancelled: 'close',
  settled: 'check-all',
  delivered: 'mail-read'
}

/** Text tone for an activity row: quiet for pass/cancel/settle, accent for
 *  work and real replies, destructive for failures and timeouts. */
function groupActivityTone(kind) {
  if (kind === 'failed' || kind === 'timed-out') {
    return 'text-destructive'
  }

  if (kind === 'working' || kind === 'replied' || kind === 'delivered') {
    return 'text-(--ui-accent,#4f9cf9)'
  }

  return 'text-(--ui-text-tertiary)'
}

function handleSessionsGatewayTransition() {
  $sessionsGatewayGeneration.set($sessionsGatewayGeneration.get() + 1)
  $botSelectedSessions.set({})
  // A gateway swap invalidates any in-flight room drive: bump every room's
  // epoch so running loops bail at their next member boundary.
  const rooms = { ...$groupChats.get() }

  for (const name of Object.keys(rooms)) {
    rooms[name] = { ...rooms[name], epoch: (rooms[name].epoch || 0) + 1, running: false }
  }

  $groupChats.set(rooms)
}

/** Per-bot appearance + display meta, persisted via ctx.storage:
 *  { [botName]: { shape, color, title } } */
const $botMeta = atom({})

async function saveBotMeta(name, patch) {
  const prevMeta = $botMeta.get()[name] || {}
  const next = { ...$botMeta.get(), [name]: { ...prevMeta, ...patch } }
  $botMeta.set(next)

  // Local plugin storage: instant, and the fallback for older gateways.
  try {
    Promise.resolve(pluginCtx?.storage?.set?.('bot-meta', next)).catch(() => undefined)
  } catch {
    /* storage unavailable — look persists for this window only */
  }

  // Server-side (source of truth when supported): profile.yaml ui_meta,
  // namespaced under this plugin's id — every client machine sees the same
  // roster. Return the outcome so user-initiated saves can distinguish a
  // cross-machine save from a local-only fallback instead of reporting a
  // false success. Data-URL fields are stripped from ui_meta (64KB cap,
  // rides every profiles.list); the avatar IMAGE goes to the profile asset
  // store instead (profiles.set_asset), which is server-side and uncapped by
  // the list call — so pfps follow the profile across machines too.
  let serverRequest = null
  try {
    const { image, pet, ...rest } = next[name] || {}
    serverRequest = Promise.resolve(host.request('profiles.configure', { name, ui_meta: { 'work4you-bots': rest } }))
  } catch {
    /* older/unavailable gateway — the local fallback remains saved */
  }

  // Avatar image → profile asset store (feature-detected; local storage
  // remains the fallback rendering source on older gateways) — but only when
  // the image actually CHANGED. Every Edit Profile save sends the image key
  // (changed or not); a no-op `clear` from one machine can race another
  // machine's just-pushed avatar and wipe it server-side, and a no-op
  // `data` push re-uploads the full data URL for nothing.
  const imageChanged = 'image' in patch && patch.image !== (prevMeta.image ?? null)
  const builtInChanged = !next[name].image && (
    ('shape' in patch && patch.shape !== prevMeta.shape) ||
    ('color' in patch && patch.color !== prevMeta.color)
  )
  if (imageChanged || builtInChanged) {
    // A ready-made character or recolored classic replaces the old notice
    // snapshot too. An unchanged save still leaves the asset alone.
    avatarPushInflight.delete(name)
    try {
      const req = next[name].image
        ? host.request('profiles.set_asset', { name, asset: 'avatar', data: next[name].image })
        : host.request('profiles.set_asset', { name, asset: 'avatar', clear: true })
      req.catch(() => undefined)
    } catch {
      /* older gateway */
    }
  }

  // Three-way outcome so callers can tell a REAL remote failure from the
  // documented legacy fallback ("older gateways reject the param shape;
  // that's fine, local wins"):
  //   'persisted'   — gateway confirmed applied.ui_meta === true
  //   'unsupported' — older gateway: request rejected, or response carries
  //                   no `applied` contract at all. Silent local fallback;
  //                   an error toast here would fire on EVERY save forever.
  //   'failed'      — gateway speaks the contract and explicitly reported
  //                   the ui_meta write did NOT apply.
  let serverOutcome = 'unsupported'
  if (serverRequest) {
    try {
      const result = await serverRequest
      if (result?.applied?.ui_meta === true) {
        serverOutcome = 'persisted'
      } else if (result && typeof result === 'object' && result.applied && typeof result.applied === 'object') {
        serverOutcome = 'failed'
      }
    } catch {
      /* older/unavailable gateway — the local fallback remains saved */
    }
  }

  return { serverPersisted: serverOutcome === 'persisted', serverOutcome }
}

// ── hidden bots (right-click → Hide Bot) ────────────────────────────────────
// Hiding is a ROSTER-DISPLAY concern only: a hidden bot keeps working —
// @mentions still resolve, group-chat membership is untouched, its name
// still counts as taken, and an open chat stays open. The flag lives in bot
// meta (`hidden: true`), so it rides the same local-storage + server
// ui_meta pipeline as pins/titles and follows the profile across machines.
// Unhide writes `hidden: false` (never null): a null key survives the local
// `{ ...prev, ...patch }` merge while the server DELETES None keys, and
// that asymmetry lets mergeServerMeta resurrect a stale truthy copy. A
// literal false round-trips identically through both stores.

/** Session-only view toggle: reveal hidden bots (dimmed) in the roster. */
const $showHiddenBots = atom(false)

/** Hidden flag for a roster row. Thin remote-source rows never read local
 *  meta (botRosterMeta returns null for them), so hide is by NAME on the
 *  active source; remote rows of the same name stay visible. */
function isBotHidden(bot, metaByName) {
  return Boolean(botRosterMeta(bot, metaByName)?.hidden)
}

/** Hiding the selected bot re-homes the selection (the Routines pane
 *  follows it): first visible bot wins, then 'default' — unless default is
 *  itself hidden with nothing else visible, in which case the selection
 *  stays put rather than pointing somewhere even less real. */
function fallbackSelectionAfterHide(name) {
  if ($selectedBot.get() !== name) {
    return
  }

  const meta = $botMeta.get()
  const visible = $lastRoster
    .get()
    .filter(bot => !bot.remoteSource && bot.name !== name && !meta[bot.name]?.hidden)

  if (visible.length) {
    $selectedBot.set(visible[0].name)
    return
  }

  if (name !== 'default' && !meta.default?.hidden) {
    $selectedBot.set('default')
  }
}

/** One-time reconciliation: Bot Mode sessions are always hidden, but rooms
 *  and Bot Chats created before this policy (or while the old pref was off)
 *  left visible rows behind. On every plugin load, sweep every session id we
 *  own — canonical chats from bot meta plus each group room's member
 *  sessions — through the core session.set_hidden RPC, then run the
 *  ownership-based sweep for the rows we DON'T know by id. Idempotent (the DB
 *  setter is a no-op on already-hidden rows) and feature-detected: older
 *  gateways lack session.set_hidden and simply keep the rows visible. */
function hideOwnedBotSessions() {
  const canonical = Object.values($botMeta.get())
    .map(m => m && m.chat)
    .filter(Boolean)
  const rooms = Object.values($groupChats.get())
    .flatMap(room => Object.values(room?.sessions || {}))
    .filter(sid => Boolean(sid) && sid !== true)
  const ids = [...new Set([...canonical, ...rooms])]

  const known = Promise.all(
    ids.map(sid =>
      Promise.resolve(host.request('session.set_hidden', { session_id: sid, hidden: true })).catch(() => undefined)
    )
  )

  return Promise.all([known, sweepBotProfileSessions().catch(() => undefined)])
}

// Titles Bot Mode itself mints for its plumbing sessions. Bot-to-bot CLI
// handoffs (`work4you -p <bot> chat --in ~ -c "Bot Chat" --create-if-missing`)
// and mention handoffs create sessions with EXACTLY these titles; the
// "Group: " prefix is the member-session title ensureGroupChatSession has
// used since group chats shipped. Exact/prefix matching is deliberate — a
// user's real conversation inside a bot profile keeps whatever title the
// user gave it and is never touched.
const BOT_MODE_SWEEP_TITLES = new Set(['Bot Chat', 'Agent Inbox'])

function isBotModeSweepTitle(title) {
  const t = String(title || '').trim()
  return BOT_MODE_SWEEP_TITLES.has(t) || t.startsWith('Group: ')
}

/** Ownership-based sweep: the id-based sweep above only covers sessions the
 *  plugin recorded ($botMeta canonical chats, $groupChats member sids), but
 *  Bot Mode sessions are ALSO minted outside the plugin — bot-to-bot CLI
 *  handoffs ("Agent Inbox" / extra "Bot Chat" rows born visible in a bot's
 *  profile) — and those ids the plugin never learns. So: enumerate each
 *  roster bot's OWN profile sessions (only bot profiles — a non-bot profile
 *  is never listed, so its sessions are never touched) and hide any VISIBLE
 *  row whose title is Bot Mode plumbing. session.list without include_hidden
 *  returns only visible rows, which keeps the sweep naturally idempotent.
 *  Remote-source bots route to their own connection via requestForBot.
 *  Feature-detected + fire-and-forget: older gateways without per-profile
 *  session.list / session.set_hidden simply reject and the sweep no-ops. */
async function sweepBotProfileSessions() {
  const cached = $lastRoster.get()
  let roster = Array.isArray(cached) && cached.length ? cached : null

  if (!roster) {
    // Plugin load can run before the Bots pane hydrates $lastRoster — fall
    // back to the active gateway's own profile list (local bots; remote
    // sources get covered by the next sweep once the roster cache exists).
    try {
      const res = await host.request('profiles.list', {})
      roster = Array.isArray(res?.profiles) ? res.profiles : []
    } catch {
      return
    }
  }

  await Promise.all(
    roster.map(async bot => {
      const name = String(bot?.name || '').trim()

      if (!name) {
        return
      }

      try {
        const res = await requestForBot(bot, 'session.list', { profile: name, limit: PROFILE_SESSION_LIST_LIMIT })
        const rows = Array.isArray(res?.sessions) ? res.sessions : []

        await Promise.all(
          rows
            .filter(row => row && row.id && isBotModeSweepTitle(row.title))
            .map(row =>
              Promise.resolve(
                requestForBot(bot, 'session.set_hidden', { session_id: row.id, hidden: true, profile: name })
              ).catch(() => undefined)
            )
        )
      } catch {
        /* older gateway / unreachable source — leave this profile alone */
      }
    })
  )
}

/** Fetch server-side avatars for roster rows flagged has_avatar when the
 *  local cache doesn't already have an image for them. Fire-and-forget. */
const avatarFetchInflight = new Set()

const avatarPushInflight = new Set()

/** Backfill: local meta has art the server lacks -> profiles.set_asset.
 *  Server-side avatars power the inter-agent notice pfp (core #85855) and
 *  cross-machine roster art, so local-only images are a bug, not a state. */
function pushLocalAvatars(roster) {
  for (const bot of roster) {
    if (bot.has_avatar || avatarPushInflight.has(bot.name)) {
      continue
    }

    const image = $botMeta.get()[bot.name]?.image

    if (image && typeof image === 'string' && image.startsWith('data:')) {
      avatarPushInflight.add(bot.name)
      host
        .request('profiles.set_asset', { name: bot.name, asset: 'avatar', data: image })
        .then(() => queryClient.invalidateQueries({ queryKey: ['work4you-bots', 'roster'] }))
        .catch(() => avatarPushInflight.delete(bot.name))
      continue
    }

    // Built-in face: snapshot the live vector or bundled character so the
    // inter-agent notices (core #85855/#85888) can show the real pfp.
    const face = document.querySelector('[data-bot-face=' + JSON.stringify(bot.name) + ']')

    if (!face) {
      continue
    }

    avatarPushInflight.add(bot.name)
    const snapshot = face.tagName.toLowerCase() === 'img'
      ? normalizeAvatarImage(face.currentSrc || face.src, 160)
      : rasterizeSvgToPng(face, 160)
    snapshot
      .then(png =>
        png
          ? host
              .request('profiles.set_asset', { name: bot.name, asset: 'avatar', data: png })
              .then(() => queryClient.invalidateQueries({ queryKey: ['work4you-bots', 'roster'] }))
          : Promise.reject(new Error('rasterize failed'))
      )
      .catch(() => avatarPushInflight.delete(bot.name))
  }
}

/** Serialize an inline SVG and draw it to a canvas -> PNG data URL. */
function rasterizeSvgToPng(svgEl, size) {
  return new Promise(resolve => {
    try {
      const clone = svgEl.cloneNode(true)
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
      clone.setAttribute('width', String(size))
      clone.setAttribute('height', String(size))
      const markup = new XMLSerializer().serializeToString(clone)
      const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markup)
      const img = new Image()

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = size
          canvas.height = size
          canvas.getContext('2d').drawImage(img, 0, 0, size, size)
          resolve(canvas.toDataURL('image/png'))
        } catch {
          resolve(null)
        }
      }
      img.onerror = () => resolve(null)
      img.src = url
    } catch {
      resolve(null)
    }
  })
}

/** The roster backfill draws the live SVG at 160x160. Pets are 96x104
 *  and uploads are 256. Use that to tell a still face-copy from a real picture. */
function isBackfilledFacePng(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png;base64,')) {
    return false
  }

  try {
    const bin = atob(dataUrl.slice('data:image/png;base64,'.length).slice(0, 48))
    if (bin.length < 24) {
      return false
    }
    const w = (bin.charCodeAt(16) << 24) | (bin.charCodeAt(17) << 16) | (bin.charCodeAt(18) << 8) | bin.charCodeAt(19)
    const h = (bin.charCodeAt(20) << 24) | (bin.charCodeAt(21) << 16) | (bin.charCodeAt(22) << 8) | bin.charCodeAt(23)
    return w === 160 && h === 160
  } catch {
    return false
  }
}

function pullServerAvatars(roster) {
  pushLocalAvatars(roster)

  for (const bot of roster) {
    if (!bot.has_avatar || avatarFetchInflight.has(bot.name)) {
      continue
    }

    if ($botMeta.get()[bot.name]?.image) {
      continue
    }

    avatarFetchInflight.add(bot.name)
    host
      .request('profiles.get_asset', { name: bot.name, asset: 'avatar' })
      .then(res => {
        if (res?.found && res.data) {
          const current = $botMeta.get()
          const mine = current[bot.name] || {}
          // A 160px raster of the vector face is only for inter-agent
          // notices. Do not park it on the roster or the live face dies.
          if (isBackfilledFacePng(res.data) && mine.imageKind !== 'photo' && !mine.pet) {
            return
          }
          $botMeta.set({ ...current, [bot.name]: { ...mine, image: res.data } })

          try {
            Promise.resolve(pluginCtx?.storage?.set?.('bot-meta', $botMeta.get())).catch(() => undefined)
          } catch {
            /* no storage */
          }
        }
      })
      .catch(() => undefined)
      .finally(() => avatarFetchInflight.delete(bot.name))
  }
}

/** Server ui_meta (per roster row) beats local storage for the compact
 *  fields it carries; local-only fields (avatar image data URL, extracted
 *  pet icon) are PRESERVED — the server copy never includes them, so a
 *  naive replace would wipe a just-saved image avatar on the next roster
 *  paint. When server bot metadata exists, an omitted chat is authoritative
 *  deletion; local still fills all gaps for older gateways with no metadata. */
function mergeServerMeta(roster) {
  const local = $botMeta.get()
  let changed = false
  const next = { ...local }

  for (const bot of roster) {
    const server = bot.ui_meta?.['work4you-bots']
    if (server && typeof server === 'object') {
      const mine = next[bot.name] || {}
      const merged = { ...mine, ...server }

      // Local-only fields survive the server overlay.
      if (mine.image) {
        merged.image = mine.image
      }

      // Server metadata is authoritative for the canonical chat pointer.
      // Without this deletion sync, ctx.storage resurrects stale sessions
      // after the server pin is cleared and even after a full app restart.
      if (
        Object.prototype.hasOwnProperty.call(mine, 'chat') &&
        !Object.prototype.hasOwnProperty.call(server, 'chat')
      ) {
        delete merged.chat
      }

      // Canonical multi-group metadata is authoritative for the compatibility
      // scalar too. A server-side `group: null` is represented by omission,
      // so retaining the local scalar would resurrect a membership that another
      // desktop just removed.
      if (
        Array.isArray(server.groups) &&
        Object.prototype.hasOwnProperty.call(mine, 'group') &&
        !Object.prototype.hasOwnProperty.call(server, 'group')
      ) {
        delete merged.group
      }

      if (JSON.stringify(next[bot.name] || null) !== JSON.stringify(merged)) {
        next[bot.name] = merged
        changed = true
      }
    }
  }

  if (changed) {
    $botMeta.set(next)

    // Persist server reconciliation so a relaunch cannot rehydrate stale
    // local fields that the server intentionally removed.
    try {
      Promise.resolve(pluginCtx?.storage?.set?.('bot-meta', next)).catch(() => undefined)
    } catch {
      /* storage unavailable — reconciliation lasts for this window only */
    }
  }
}

/** Clone a bot: profile (config/skills/SOUL/memory via clone_from) + look.
 *  Name is "<base>-2", "-3", … — first free slot against the live roster. */
async function duplicateBot(bot, roster) {
  const base = bot.name
  let name = null
  for (let n = 2; n < 100; n++) {
    // Truncate the BASE, never the suffix — slicing the joined string chops
    // the "-2" off a max-length name and the candidate collides with the
    // base forever (#19).
    const suffix = `-${n}`
    const candidate = base.slice(0, 64 - suffix.length) + suffix
    if (!roster.some(b => b.name === candidate)) {
      name = candidate
      break
    }
  }

  if (!name) {
    throw new Error(tr('roster.noFreeName'))
  }

  await host.request('profiles.create', {
    name,
    clone_from: base,
    description: bot.description || ''
  })

  // Same look: avatar shape/color/image and a "(copy)" title so the two
  // are tellable apart in the roster until the user renames. Do not copy
  // chat or created. Those belong to the original bot.
  const meta = $botMeta.get()[base]
  if (meta) {
    const { chat, created, ...look } = meta
    saveBotMeta(name, {
      ...look,
      title: meta.title ? tr('roster.copyTitle', meta.title) : ''
    })
  }

  return name
}

/** Permanently delete a bot's Work4You profile, then remove plugin-local state
 * that would otherwise leave stale appearance/unread data behind.
 *
 * Prefer the SDK's `host.deleteProfile` when this Desktop build ships it: it
 * routes through the Electron-intercepted REST delete, which tears down the
 * bot's pool backend FIRST and routes the next request away from it. The
 * older `cli.exec` path bypasses that interception, so a backend that the
 * roster's hover pre-warm just woke (right-click hovers the row!) holds the
 * profile dir open — the CLI's rmtree races the live backend and the
 * renderer's socket reconnect respawns it mid-delete, resurrecting the
 * directory (work4you#52279). That is the "can't delete a bot" error. */
async function deleteBot(bot) {
  if (typeof host.deleteProfile === 'function') {
    await host.deleteProfile(bot.name)
  } else {
    // Older desktop without the SDK verb — best effort via the CLI.
    const result = await host.request('cli.exec', {
      argv: ['profile', 'delete', bot.name, '--yes']
    })

    if (result?.blocked || result?.code !== 0) {
      throw new Error(result?.hint || result?.output || tr('roster.deleteFailed', bot.name))
    }
  }

  const meta = { ...$botMeta.get() }
  delete meta[bot.name]
  $botMeta.set(meta)

  try {
    await Promise.resolve(pluginCtx?.storage?.set?.('bot-meta', meta))
  } catch {
    /* profile is deleted; stale local appearance is harmless if storage fails */
  }

  const unread = { ...$botUnread.get() }
  delete unread[bot.name]
  $botUnread.set(unread)
  rosterWatermarks.delete(bot.name)
  avatarFetchInflight.delete(bot.name)
  avatarPushInflight.delete(bot.name)

  if ($selectedBot.get() === bot.name) {
    $selectedBot.set('default')
  }

  queryClient.invalidateQueries({ queryKey: ROSTER_KEY })

  if (host.state.profile.get?.() === bot.name && typeof host.newChat === 'function') {
    host.newChat('default')
  }
}

// ── avatars (shape + color + eyes) ──────────────────────────────────────────

// The original flat shapes. Sigils ('sigil-N') and platonic
// solids remain render-only so any bot that picked one during the experiments
// keeps its look.
// Radix ScrollArea's viewport wraps children in a display:table div that
// sizes to content — unbounded width means `truncate` below it never fires
// and previews run through the panel edge. Scope-limited corrective.
//
// A second Radix quirk bites in the dialogs: the viewport is height:100%,
// which computes to auto when the root only has max-height (no definite
// height anywhere up the chain) — the viewport grows to full content height,
// the root's overflow:hidden clips it, and NOTHING scrolls (#88). Capping
// the viewport itself (inheriting the root's max-height) makes it the real
// scroll container; lists shorter than the cap still shrink to fit.
if (typeof document !== 'undefined' && !document.getElementById('work4you-bots-roster-css')) {
  const style = document.createElement('style')
  style.id = 'work4you-bots-roster-css'
  style.textContent =
    '.work4you-bots-roster [data-radix-scroll-area-viewport] > div {' +
    ' display: block !important; width: 100%; min-width: 0; }' +
    '.work4you-scroll-cap > [data-radix-scroll-area-viewport] { max-height: inherit; }' +
    '@keyframes work4you-bots-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }' +
    '.work4you-bots-pulse { animation: work4you-bots-pulse 1.2s ease-in-out infinite; }'
  document.head.appendChild(style)
}

// ── avatar engine ───────────────────────────────────────────────────────────
// The face (BotFace), its animation clock, the shape/color tables and the
// name → look resolver (botAppearance) live in the desktop app now
// (src/lib/bot-avatar.ts, src/lib/bot-face-clock.ts,
// src/components/ui/bot-face.tsx) so the sidebar profile rail and this roster
// draw the SAME bot. Pulled from the SDK namespace, not the named import, so a
// stale desktop still links; there the roster degrades to a plain colored tile
// instead of crashing, and the shape helpers answer with the classic vocabulary.
const avatarSdk = typeof sdk === 'undefined' ? {} : sdk

const AVATAR_SHAPES = avatarSdk.AVATAR_SHAPES || ['circle', 'squircle', 'pill', 'triangle', 'hexagon', 'cloud', 'drop']
const AVATAR_PICKER_SHAPES = avatarSdk.AVATAR_PICKER_SHAPES || ['circle', 'blob', ...AVATAR_SHAPES.slice(1)]
const AVATAR_COLORS = avatarSdk.AVATAR_COLORS || [
  '#f5f5f4',
  '#8d6748',
  '#ef4444',
  '#f97316',
  '#14b8a6',
  '#38bdf8',
  '#3b40c8',
  '#8b5cf6',
  '#ec4899',
  '#9ca3af'
]
const BLOB_KINDS = avatarSdk.BLOB_KINDS || []

const defaultShapeFor =
  avatarSdk.defaultShapeFor ||
  (name => {
    let hash = 0
    for (const ch of name || '') {
      hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
    }
    return AVATAR_SHAPES[hash % AVATAR_SHAPES.length]
  })
const isBlobShape = avatarSdk.isBlobShape || (() => false)
const parseBlobShape = avatarSdk.parseBlobShape || ((_shape, name) => ({ seed: name || 'agent', seedPart: '', kind: '' }))
const blobShapeString = avatarSdk.blobShapeString || (() => 'blobatar')
const botAppearance =
  avatarSdk.botAppearance ||
  ((name, meta) => ({
    shape: meta?.shape || defaultShapeFor(name),
    color: meta?.color || profileColor(name) || '#8b5cf6',
    image: meta?.image || null
  }))

/** Stale-desktop stand-in for the app's BotFace: the photo, else a plain
 *  colored tile. Keeps `data-bot-face` so the PNG backfill still finds it. */
function LegacyBotTile({ color, image, size = 36, name = 'agent' }) {
  if (image) {
    return jsx('img', {
      src: image,
      alt: '',
      'aria-hidden': true,
      style: { width: size, height: size, borderRadius: '22%', objectFit: 'cover', display: 'block' }
    })
  }
  return jsx('svg', {
    'data-bot-face': name,
    viewBox: '0 0 40 40',
    width: size,
    height: size,
    'aria-hidden': true,
    children: jsx('rect', { x: 3, y: 3, width: 34, height: 34, rx: 11, fill: color })
  })
}

const BotFace = avatarSdk.BotFace || LegacyBotTile

// -- inline MCP setup (per-profile), driven by the mcp.servers.* gateway RPCs --
// Feature-detected: if the gateway predates those RPCs the setup button hides
// and the row falls back to the "run work4you mcp / Settings" hint. profile is
// the target bot's profile name (its config is what we write).

async function mcpRpc(method, params) {
  // Returns { ok, result } or { ok:false, unsupported:true } when the gateway
  // doesn't know the method (older backend) vs a real error.
  try {
    const res = await host.request(method, params)
    return { ok: true, result: res }
  } catch (err) {
    const msg = String((err && err.message) || err || '')
    if (/unknown method/i.test(msg)) {
      return { ok: false, unsupported: true }
    }
    return { ok: false, error: msg }
  }
}

// Probe whether the new lifecycle RPCs exist on this gateway (cached per session).
let _mcpRpcSupported = null
async function mcpSetupSupported() {
  if (_mcpRpcSupported !== null) {
    return _mcpRpcSupported
  }
  const r = await mcpRpc('mcp.servers.list', {})
  _mcpRpcSupported = !(r.ok === false && r.unsupported)
  return _mcpRpcSupported
}

function McpSetupButton({ profile, entry, onDone, ensureProfile }) {
  // entry: { name, requires:[env keys], auth?, fromCatalog, installed }
  // profile may be null at first (New Agent: the profile isn't created yet).
  // ensureProfile() lazily creates it on the first setup action and returns the
  // slug, so OAuth / API-key setup works DURING creation, not only in Edit.
  const t = useBotModeT()
  const [phase, setPhase] = useState('idle') // idle | keys | oauth | busy | done | error
  const [supported, setSupported] = useState(null)
  const [keyValues, setKeyValues] = useState({})
  const [message, setMessage] = useState('')
  const pollRef = useRef(null)
  const profileRef = useRef(profile || null)

  useEffect(() => {
    if (profile) {
      profileRef.current = profile
    }
  }, [profile])

  // Resolve the target profile, creating it on demand for the New Agent flow.
  const resolveProfile = async () => {
    if (profileRef.current) {
      return profileRef.current
    }
    if (ensureProfile) {
      const created = await ensureProfile()
      if (created) {
        profileRef.current = created
      }
      return created
    }
    return null
  }

  useEffect(() => {
    let alive = true
    mcpSetupSupported().then(ok => {
      if (alive) setSupported(ok)
    })
    return () => {
      alive = false
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [])

  const isOAuth = (entry.auth || '').toLowerCase() === 'oauth'
  const requires = entry.requires || []

  const beginKeys = async () => {
    // Ensure the server exists in the target profile first (add from catalog).
    setPhase('busy')
    setMessage('')
    const profile = await resolveProfile()
    if (!profile) {
      setPhase('idle')
      return
    }
    if (entry.fromCatalog && !entry.installed) {
      const add = await mcpRpc('mcp.servers.add', { profile, name: entry.name, preset: entry.name })
      if (!add.ok) {
        setPhase('error')
        setMessage(add.error || t('mcp.addFailed'))
        return
      }
    }
    setPhase(isOAuth ? 'oauth' : 'keys')
  }

  const submitKeys = async () => {
    setPhase('busy')
    const profile = profileRef.current
    if (!profile) {
      setPhase('error')
      setMessage(t('mcp.noProfile'))
      return
    }
    for (const k of requires) {
      const val = (keyValues[k] || '').trim()
      if (!val) {
        continue
      }
      const r = await mcpRpc('mcp.servers.set_api_key', { profile, name: entry.name, env_var: k, value: val })
      if (!r.ok) {
        setPhase('error')
        setMessage(r.error || t('mcp.setKeyFailed', k))
        return
      }
    }
    // Verify via test.
    const test = await mcpRpc('mcp.servers.test', { profile, name: entry.name })
    if (test.ok && test.result && (test.result.ok || (test.result.result && test.result.result.ok))) {
      setPhase('done')
      host.notify({ kind: 'success', message: t('mcp.configured', entry.name) })
      onDone && onDone()
    } else {
      setPhase('error')
      setMessage(
        (test.result && (test.result.error || (test.result.result && test.result.result.error))) || t('mcp.testFailed')
      )
    }
  }

  const beginOAuth = async () => {
    // A second click (retry, impatient double-click) must not orphan the
    // previous poll interval — an overwritten pollRef leaks a 2s poller that
    // runs until unmount and can flip phase from a stale OAuth session.
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    setPhase('busy')
    setMessage('')
    const profile = await resolveProfile()
    if (!profile) {
      setPhase('idle')
      return
    }
    if (entry.fromCatalog && !entry.installed) {
      const add = await mcpRpc('mcp.servers.add', { profile, name: entry.name, preset: entry.name })
      if (!add.ok) {
        setPhase('error')
        setMessage(add.error || t('mcp.addFailed'))
        return
      }
    }
    const start = await mcpRpc('mcp.servers.oauth.start', { profile, name: entry.name })
    const payload = start.result && (start.result.result || start.result)
    const authUrl = payload && (payload.auth_url || payload.verification_url)
    const sessionId = payload && payload.session_id
    if (!start.ok || !authUrl || !sessionId) {
      setPhase('error')
      setMessage(start.error || t('mcp.oauthStartFailed'))
      return
    }
    // Open the auth URL in the native browser, same as provider OAuth.
    try {
      if (host.openExternal) {
        host.openExternal(authUrl)
      } else if (typeof window !== 'undefined' && window.work4youDesktop && window.work4youDesktop.openExternal) {
        window.work4youDesktop.openExternal(authUrl)
      } else {
        window.open(authUrl, '_blank')
      }
    } catch {
      /* fall through to poll; user can open the URL from the toast */
    }
    setPhase('oauth')
    setMessage(t('mcp.completeSignIn'))
    pollRef.current = setInterval(async () => {
      const poll = await mcpRpc('mcp.servers.oauth.poll', { profile, name: entry.name, session_id: sessionId })
      const pd = poll.result && (poll.result.result || poll.result)
      const status = pd && pd.status
      if (status === 'approved') {
        clearInterval(pollRef.current)
        pollRef.current = null
        setPhase('done')
        host.notify({ kind: 'success', message: t('mcp.authenticated', entry.name) })
        onDone && onDone()
      } else if (status === 'error') {
        clearInterval(pollRef.current)
        pollRef.current = null
        setPhase('error')
        setMessage((pd && pd.error_message) || t('mcp.oauthFailed'))
      }
    }, 2000)
  }

  if (supported === false) {
    return jsx('span', {
      className: 'ml-1.5 text-[0.65rem] text-(--ui-text-quaternary)',
      children: t('mcp.needsSetup', requires.join(', '))
    })
  }
  if (phase === 'done') {
    return jsx('span', { className: 'ml-1.5 text-[0.65rem] text-(--ui-success,#22c55e)', children: t('mcp.setUpDone') })
  }
  if (phase === 'keys') {
    return jsxs('div', {
      className: 'mt-1 grid gap-1',
      children: [
        ...requires.map(k =>
          jsx(Input, {
            key: k,
            type: 'password',
            className: 'h-6 text-[0.7rem]',
            placeholder: k,
            value: keyValues[k] || '',
            onChange: e => setKeyValues(prev => ({ ...prev, [k]: e.target.value }))
          }, k)
        ),
        jsxs('div', {
          className: 'flex gap-1',
          children: [
            jsx(Button, {
              size: 'xs',
              variant: 'secondary',
              onClick: () => void submitKeys(),
              children: t('mcp.saveAndTest')
            }),
            jsx(Button, { size: 'xs', variant: 'ghost', onClick: () => setPhase('idle'), children: t('common.cancel') })
          ]
        })
      ]
    })
  }
  if (phase === 'oauth') {
    return jsx('span', {
      className: 'ml-1.5 text-[0.65rem] text-(--ui-text-quaternary)',
      children: message || t('mcp.authorizing')
    })
  }
  if (phase === 'busy') {
    return jsx('span', { className: 'ml-1.5 text-[0.65rem] text-(--ui-text-quaternary)', children: t('mcp.working') })
  }
  if (phase === 'error') {
    return jsxs('span', {
      className: 'ml-1.5 text-[0.65rem] text-(--ui-danger,#ef4444)',
      children: [
        (message || t('mcp.setupFailed')) + ' ',
        jsx('button', { className: 'underline', onClick: () => setPhase('idle'), children: t('mcp.retry') })
      ]
    })
  }
  // idle
  return jsx('button', {
    className: 'ml-1.5 text-[0.65rem] text-(--ui-accent,#4f9cf9) underline',
    onClick: () => void (isOAuth ? beginOAuth() : beginKeys()),
    children: isOAuth ? t('mcp.signIn') : t('mcp.setUp')
  })
}

// ── image avatars: upload from device + generate via image.generate ─────────

/** Downscale to a small square so plugin storage stays light. */
function normalizeAvatarImage(dataUrl, edge = 256) {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = edge
        canvas.height = edge
        const ctx2d = canvas.getContext('2d')
        const side = Math.min(img.width, img.height)
        ctx2d.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, edge, edge)
        resolve(canvas.toDataURL('image/png'))
      } catch {
        resolve(dataUrl)
      }
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

function pickImageFromDevice() {
  return new Promise(resolve => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/png,image/jpeg,image/webp,image/gif'
    input.onchange = () => {
      const file = input.files?.[0]

      if (!file) {
        return resolve(null)
      }

      if (file.size > 15_000_000) {
        host.notify({ kind: 'error', message: tr('avatar.imageTooLarge') })
        return resolve(null)
      }

      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(file)
    }
    input.click()
  })
}

// ── group-chat attachments: pick/paste/drop files the room's members see ────

/** Classify a picked file for the group-attachment pipeline. */
function groupAttachmentKind(file) {
  if (/^image\//.test(file.type || '')) {
    return 'image'
  }

  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '')) {
    return 'pdf'
  }

  return 'file'
}

/** File objects → [{ name, data, kind }] (data URLs), oversized files skipped
 *  with a toast. Images are downscaled; PDFs and other files ride as raw data
 *  URLs for the gateway's pdf.attach / file.attach staging. Shared by the
 *  picker button, the composer paste handler, and room drag & drop. */
async function filesToGroupAttachments(files) {
  const picked = []

  for (const file of [...(files || [])]) {
    if (!file) {
      continue
    }

    if (file.size > 15_000_000) {
      host.notify({ kind: 'error', message: tr('attachments.tooLarge', file.name || tr('attachments.unnamed')) })
      continue
    }

    const data = await new Promise(done => {
      const reader = new FileReader()
      reader.onload = () => done(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => done(null)
      reader.readAsDataURL(file)
    })

    if (!data) {
      continue
    }

    const kind = groupAttachmentKind(file)
    picked.push({
      name: file.name || (kind === 'image' ? 'pasted image' : 'attachment'),
      data: kind === 'image' ? await normalizeGroupAttachment(data) : data,
      kind
    })
  }

  return picked
}

/** Multi-file picker for the group composer — any file type; kind decides
 *  the staging RPC. Resolves to [{ name, data, kind }]. */
function pickGroupAttachments() {
  return new Promise(resolve => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.onchange = () => resolve(filesToGroupAttachments(input.files))
    input.click()
  })
}

/** Bound a group attachment's long edge so room logs (persisted with the
 *  plugin's other durable state) stay light while screenshots keep enough
 *  resolution for vision models to read text. No-op for small images or
 *  anything the canvas can't decode. */
function normalizeGroupAttachment(dataUrl, maxEdge = 1568) {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      try {
        const long = Math.max(img.width, img.height)

        if (!long || long <= maxEdge) {
          return resolve(dataUrl)
        }

        const scale = maxEdge / long
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(img.width * scale))
        canvas.height = Math.max(1, Math.round(img.height * scale))
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/png'))
      } catch {
        resolve(dataUrl)
      }
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

/** Cached probe: does the gateway have an image backend? A `false` answer
 *  is re-checked on every dialog open — the gateway may have been restarted
 *  (picking up image.generate) or a backend enabled since the last probe.
 *  Only `true` is sticky. */
const $imagenAvailable = atom(null)
let imagenProbeInflight = null

function probeImagen() {
  if (imagenProbeInflight) {
    return imagenProbeInflight
  }

  imagenProbeInflight = host
    .request('image.generate', { probe: true })
    .then(res => $imagenAvailable.set(Boolean(res?.available)))
    .catch(() => $imagenAvailable.set(false))
    .finally(() => {
      imagenProbeInflight = null
    })

  return imagenProbeInflight
}

async function generateAvatarImage(bot, title, description) {
  const who = [title || bot, description].filter(Boolean).join(' — ')
  const res = await host.request('image.generate', {
    prompt:
      `Cute minimal robot avatar for an AI agent named "${who}". ` +
      'Friendly simple mascot face, bold flat vector style, solid color background, centered, no text.',
    aspect_ratio: 'square'
  })

  if (!res?.success) {
    throw new Error(res?.error || tr('avatar.generationFailed'))
  }

  // image_data (data URL) works over local AND remote gateways; the raw
  // backend URL is the fallback when the gateway couldn't inline it.
  return res.image_data || res.image
}

/** Shape grid + color swatches, shared by Edit Profile and New Agent.
 *  Layout uses inline grid styles — arbitrary Tailwind classes like
 *  `grid-cols-7` are NOT in the app's precompiled CSS, which collapsed
 *  this into a single vertical column. */
const avatarGatewayRequest = (method, params) => host.request(method, params)

function AvatarPicker(props) {
  if (!avatarSdk.AvatarPicker) {
    return jsx(LegacyAvatarPicker, props)
  }

  const { generateSeed, ...appearance } = props

  return jsx(avatarSdk.AvatarPicker, {
    ...appearance,
    name: generateSeed?.name || 'agent',
    title: generateSeed?.title,
    request: avatarGatewayRequest
  })
}

// Compatibility for this plugin loaded by a desktop predating the shared picker.
function LegacyAvatarPicker({ shape, color, image, onShape, onColor, onImage, generateSeed }) {
  const t = useBotModeT()
  const pickerName = generateSeed?.name || 'agent'
  const imagen = useValue($imagenAvailable)
  const [tab, setTab] = useState('bot')
  const [describe, setDescribe] = useState('')
  const [genBusy, setGenBusy] = useState(false)

  if (imagen === null) {
    void probeImagen()
  }

  // Re-check a stale "unavailable" whenever the user lands on the Generate
  // tab — the gateway may have restarted with image.generate since.
  const goTab = id => {
    setTab(id)

    if (id === 'generate' && $imagenAvailable.get() === false) {
      $imagenAvailable.set(null)
      void probeImagen()
    }
  }

  const upload = async () => {
    const raw = await pickImageFromDevice()

    if (raw) {
      onImage(await normalizeAvatarImage(raw))
    }
  }

  const generate = async () => {
    if (genBusy) {
      return
    }

    setGenBusy(true)

    try {
      const custom = describe.trim()
      const img = custom
        ? await (async () => {
            const res = await host.request('image.generate', {
              prompt: `${custom}. Avatar for an AI agent: centered, bold flat vector style, solid color background, no text.`,
              aspect_ratio: 'square'
            })

            if (!res?.success) {
              throw new Error(res?.error || t('avatar.generationFailed'))
            }

            return res.image_data || res.image
          })()
        : await generateAvatarImage(generateSeed?.name || 'agent', generateSeed?.title, generateSeed?.description)

      if (img) {
        onImage(await normalizeAvatarImage(img))
      }
    } catch (err) {
      host.notifyError(err, t('avatar.generateFailed'))
    } finally {
      setGenBusy(false)
    }
  }

  return jsxs('div', {
    className: 'grid w-full min-w-0 justify-items-center gap-3',
    children: [
      jsx(SegmentedControl, {
        className: choiceClass,
        value: tab,
        onChange: goTab,
        options: [
          { id: 'bot', label: t('avatar.tabs.bot') },
          { id: 'generate', label: t('avatar.tabs.generate') },
          { id: 'upload', label: t('avatar.tabs.upload') },
          { id: 'pet', label: t('avatar.tabs.pet') }
        ]
      }),

      image && tab !== 'generate'
        ? jsx(Button, {
            type: 'button',
            variant: 'ghost',
            size: 'sm',
            onClick: () => onImage(null),
            children: t('avatar.removeImage')
          })
        : null,

      tab === 'bot'
        ? isBlobShape(shape) && blobatarSvg
          ? (() => {
              const { seedPart, kind } = parseBlobShape(shape, pickerName)
              const locked = Boolean(seedPart)
              return jsxs('div', {
                className: 'grid justify-items-center gap-3',
                children: [
                  // Silhouette pins: Auto (name decides) + the six blob kinds.
                  jsx('div', {
                    style: {
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                      gap: '6px',
                      justifyItems: 'center'
                    },
                    children: ['', ...BLOB_KINDS].map(k =>
                      jsx(
                        'button',
                        {
                          type: 'button',
                          title: k || t('avatar.blobAutoHint'),
                          className: cn(
                            'flex items-center justify-center rounded-md transition-colors hover:bg-(--chrome-action-hover)',
                            k === kind && !image && 'ring-1 ring-(--ui-accent)'
                          ),
                          style: { width: 44, height: 44 },
                          onClick: () => {
                            onImage(null)
                            onShape(blobShapeString(seedPart, k))
                          },
                          children: k
                            ? jsx(BotFace, { shape: blobShapeString(seedPart, k), color, size: 32, name: pickerName })
                            : jsx('span', { className: hintClass, children: t('avatar.blobAuto') })
                        },
                        k || 'auto'
                      )
                    )
                  }),
                  jsxs('div', {
                    className: 'flex items-center gap-1',
                    children: [
                      jsxs(Button, {
                        type: 'button',
                        variant: 'ghost',
                        size: 'sm',
                        onClick: () => {
                          onImage(null)
                          onShape(blobShapeString(Math.random().toString(36).slice(2, 10), kind))
                        },
                        children: [
                          jsx(Codicon, { name: 'refresh', className: 'mr-1 text-[0.8rem]' }),
                          t('avatar.randomize')
                        ]
                      }),
                      jsxs(Button, {
                        type: 'button',
                        variant: 'ghost',
                        size: 'sm',
                        title: locked ? t('avatar.unlockHint') : t('avatar.lockHint'),
                        onClick: () => onShape(blobShapeString(locked ? '' : pickerName, kind)),
                        children: [
                          jsx(Codicon, { name: locked ? 'unlock' : 'lock', className: 'mr-1 text-[0.8rem]' }),
                          locked ? t('avatar.unlock') : t('avatar.lockFace')
                        ]
                      })
                    ]
                  }),
                  jsx('div', {
                    className: cn('text-center', hintClass),
                    children: locked ? t('avatar.faceLocked') : t('avatar.faceFollowsName')
                  }),
                  jsx(Button, {
                    type: 'button',
                    variant: 'ghost',
                    size: 'sm',
                    className: 'text-[length:var(--conversation-text-font-size)] text-(--ui-text-secondary)',
                    onClick: () => onShape(defaultShapeFor(pickerName)),
                    children: t('avatar.classicShapes')
                  })
                ]
              })
            })()
          : jsxs('div', {
            className: 'grid justify-items-center gap-3',
            children: [
              jsx('div', {
                style: {
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                  gap: '6px',
                  justifyItems: 'center'
                },
                children: (blobatarSvg ? ['blobatar', ...AVATAR_PICKER_SHAPES] : AVATAR_PICKER_SHAPES).map(s =>
                  jsx(
                    'button',
                    {
                      type: 'button',
                      title: s === 'blobatar' ? t('avatar.blobFace') : undefined,
                      className: cn(
                        'flex items-center justify-center rounded-md transition-colors hover:bg-(--chrome-action-hover)',
                        s === shape && !image && 'ring-1 ring-(--ui-accent)'
                      ),
                      style: { width: 44, height: 44 },
                      onClick: () => {
                        onImage(null)
                        onShape(s)
                      },
                      children: jsx(BotFace, { shape: s, color, size: 32, name: pickerName })
                    },
                    s
                  )
                )
              }),
              jsx('div', {
                style: {
                  display: 'grid',
                  gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
                  gap: '8px',
                  justifyItems: 'center'
                },
                children: AVATAR_COLORS.map(c =>
                  jsx(
                    'button',
                    {
                      type: 'button',
                      className: cn(
                        'rounded-full transition-transform hover:scale-110',
                        c === color && 'ring-2 ring-(--ui-accent) ring-offset-1 ring-offset-(--ui-bg, transparent)'
                      ),
                      style: { width: 22, height: 22, backgroundColor: c },
                      onClick: () => onColor(c)
                    },
                    c
                  )
                )
              })
            ]
          })
        : null,

      tab === 'generate'
        ? imagen
          ? jsxs('div', {
              className: 'grid w-full gap-2',
              children: [
                jsx(Textarea, {
                  className: 'min-h-16 text-xs',
                  placeholder: t('avatar.describe'),
                  value: describe,
                  onChange: event => setDescribe(event.target.value)
                }),
                jsxs(Button, {
                  type: 'button',
                  variant: 'secondary',
                  className: 'w-full justify-center',
                  disabled: genBusy,
                  onClick: generate,
                  children: [
                    genBusy
                      ? jsx(GlyphSpinner, { spinner: 'breathe', className: 'mr-1 text-[0.8rem]' })
                      : jsx(Codicon, { name: 'sparkle', className: 'mr-1 text-[0.8rem]' }),
                    genBusy ? t('common.generating') : t('common.generate')
                  ]
                }),
                describe.trim()
                  ? null
                  : jsx('div', {
                      className: cn('text-center', hintClass),
                      children: t('avatar.generateHint')
                    })
              ]
            })
          : jsx('div', {
              className: 'px-2 py-3 text-center text-xs leading-5 text-(--ui-text-tertiary)',
              children: imagen === false ? t('avatar.noImageModel') : t('avatar.checkingImageModel')
            })
        : null,

      tab === 'upload'
        ? jsxs(Button, {
            type: 'button',
            variant: 'secondary',
            className: 'w-full justify-center',
            onClick: upload,
            children: [
              jsx(Codicon, { name: 'device-camera', className: 'mr-1 text-[0.8rem]' }),
              t('avatar.chooseImage')
            ]
          })
        : null,

      tab === 'pet' ? jsx(PetTab, { image, onImage }) : null
    ]
  })
}

// ── pet tab: attach a petdex companion that lives beside the avatar ─────────

// A petdex "spritesheet" is the FULL animation sheet (1536×1872 webp, ~2MB;
// 8×9 grid of 192×208 frames). Using it as an <img> both downloads megabytes
// per tile and shows the whole sheet squashed. Extract frame 0 once per slug
// via canvas, downscale to 96px, and cache the data URL. Concurrency-capped
// so opening the tab doesn't fire dozens of 2MB fetches at once.
const PET_FRAME_W = 192
const PET_FRAME_H = 208
const petFrameCache = new Map()
let petFetchActive = 0
const petFetchQueue = []

function pumpPetQueue() {
  while (petFetchActive < 4 && petFetchQueue.length) {
    const job = petFetchQueue.shift()
    petFetchActive++
    job().finally(() => {
      petFetchActive--
      pumpPetQueue()
    })
  }
}

function petFrameIcon(spriteUrl) {
  if (!spriteUrl) {
    return Promise.resolve(null)
  }

  if (!petFrameCache.has(spriteUrl)) {
    petFrameCache.set(
      spriteUrl,
      new Promise(resolve => {
        petFetchQueue.push(async () => {
          try {
            const resp = await fetch(spriteUrl, { signal: AbortSignal.timeout(15000) })
            const blob = await resp.blob()
            // Crop frame 0 during decode — never materialize the full sheet.
            const bitmap = await createImageBitmap(blob, 0, 0, PET_FRAME_W, PET_FRAME_H)
            const canvas = document.createElement('canvas')
            canvas.width = 96
            canvas.height = 104
            canvas.getContext('2d').drawImage(bitmap, 0, 0, 96, 104)
            bitmap.close()
            resolve(canvas.toDataURL('image/png'))
          } catch {
            petFrameCache.delete(spriteUrl)
            resolve(null)
          }
        })
        pumpPetQueue()
      })
    )
  }

  return petFrameCache.get(spriteUrl)
}

/** One pet tile image: frame 0 only, resolved lazily through the cache. */
function PetThumb({ spriteUrl, size = 40 }) {
  const [icon, setIcon] = useState(null)

  useEffect(() => {
    let alive = true
    petFrameIcon(spriteUrl).then(url => {
      if (alive) {
        setIcon(url)
      }
    })
    return () => {
      alive = false
    }
  }, [spriteUrl])

  if (!icon) {
    return jsx('div', {
      style: { width: size, height: size, borderRadius: 6, background: 'var(--chrome-action-hover, rgba(255,255,255,0.06))' }
    })
  }

  return jsx('img', {
    src: icon,
    alt: '',
    style: { width: size, height: size, objectFit: 'contain', imageRendering: 'pixelated', borderRadius: 6 }
  })
}

function PetTab({ image, onImage }) {
  // Selection is dialog-local: committed by the dialog's Save like any
  // uploaded/generated image (a direct meta write here gets clobbered by
  // Save's own image state).
  const t = useBotModeT()
  const [selectedSlug, setSelectedSlug] = useState(null)
  const { data, isLoading } = useQuery({
    queryKey: [ID, 'pet-gallery'],
    queryFn: () => host.request('pet.gallery', {}),
    staleTime: 300000
  })
  const [query, setQuery] = useState('')
  // Windowed rendering: the gallery is 4500+ pets — mounting an <img> per pet
  // froze the dialog. Render `limit` at a time and grow on scroll-to-bottom.
  const [limit, setLimit] = useState(24)
  const pets = data?.pets ?? []

  if (isLoading) {
    return jsx('div', {
      className: 'flex justify-center py-4',
      children: jsx(GlyphSpinner, { spinner: 'breathe', className: 'text-(--ui-text-tertiary)' })
    })
  }

  if (!pets.length) {
    return jsx('div', {
      className: 'px-2 py-3 text-center text-xs text-(--ui-text-tertiary)',
      children: t('avatar.noPets')
    })
  }

  const q = query.trim().toLowerCase()
  const filtered = q
    ? pets.filter(pet => (pet.displayName || '').toLowerCase().includes(q) || (pet.slug || '').includes(q))
    : pets
  // Installed and curated pets surface first — they're the likeliest picks.
  const ranked = filtered.slice().sort((a, b) => {
    const rank = pet => (pet.installed ? 0 : pet.curated ? 1 : 2)
    return rank(a) - rank(b)
  })
  const visible = ranked.slice(0, limit)

  const onScroll = event => {
    const el = event.currentTarget

    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 120 && limit < ranked.length) {
      setLimit(prev => Math.min(prev + 24, ranked.length))
    }
  }

  return jsxs('div', {
    className: 'grid w-full gap-2',
    children: [
      jsx('div', {
        className: 'text-center text-[0.65rem] text-(--ui-text-quaternary)',
        children: t('avatar.petPick')
      }),
      jsx(Input, {
        className: 'h-7 text-xs',
        placeholder: t('avatar.petSearch', pets.length),
        value: query,
        onChange: event => {
          setQuery(event.target.value)
          setLimit(24)
        }
      }),
      image && selectedSlug
        ? jsx(Button, {
            type: 'button',
            variant: 'ghost',
            size: 'sm',
            className: 'justify-center',
            onClick: () => {
              setSelectedSlug(null)
              onImage(null)
            },
            children: t('avatar.removePet')
          })
        : null,
      filtered.length === 0
        ? jsx('div', {
            className: 'py-3 text-center text-xs text-(--ui-text-quaternary)',
            children: t('avatar.noPetsMatch')
          })
        : jsxs('div', {
            onScroll,
            style: { maxHeight: 220, overflowY: 'auto' },
            children: [
              jsx('div', {
                style: {
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                  gap: '6px'
                },
                children: visible.map(pet =>
                  jsxs(
                    'button',
                    {
                      type: 'button',
                      className: cn(
                        'grid justify-items-center gap-1 rounded-md p-1.5 transition-colors hover:bg-(--chrome-action-hover)',
                        selectedSlug === pet.slug && 'ring-1 ring-(--ui-accent)'
                      ),
                      onClick: () => {
                        // The pet IS the profile picture: extract frame 0
                        // and hand it to the dialog as the avatar image.
                        // Persisted when the user hits Save.
                        setSelectedSlug(pet.slug)
                        void petFrameIcon(pet.spritesheetUrl).then(icon => {
                          if (icon) {
                            onImage(icon)
                          } else {
                            setSelectedSlug(null)
                            host.notify({ kind: 'error', message: t('avatar.petFailed') })
                          }
                        })
                      },
                      children: [
                        jsx(PetThumb, { spriteUrl: pet.spritesheetUrl, size: 40 }),
                        jsx('span', {
                          className: 'w-full truncate text-center text-[0.6rem] text-(--ui-text-tertiary)',
                          children: pet.displayName
                        })
                      ]
                    },
                    pet.slug
                  )
                )
              }),
              limit < ranked.length
                ? jsx('div', {
                    className: 'py-2 text-center text-[0.65rem] text-(--ui-text-quaternary)',
                    children: t('avatar.scrollMore', limit, ranked.length)
                  })
                : null
            ]
          })
    ]
  })
}

// ── data ─────────────────────────────────────────────────────────────────────

/** True once profiles.list reports the backend injects the bot-to-bot
 *  protocol into the system prompt itself (work4you bot_mode_probe).
 *  Gates every SOUL.md protocol append below. */
let serverInjectsProtocol = false

/** Pins to resolve precisely on the next roster poll: {profile: chatId}.
 *  The backend answers "what about THIS conversation" per entry
 *  (preferred_session), so a row's preview can describe the same session its
 *  click opens (work4you#88200). Unknown params are ignored by older
 *  gateways, which simply omit the field. */
function preferredSessionIds(allMeta) {
  const pins = {}
  for (const [name, meta] of Object.entries(allMeta || {})) {
    if (meta?.chat) {
      pins[name] = meta.chat
    }
  }
  return pins
}

/** The roster query (shared cache). `poll: false` reads it — fetching only
 *  when stale — without starting a second 5s poller beside the Bots pane's. */
function useRoster({ poll = true } = {}) {
  const activeConnectionId = useValue(host.state.connectionId)

  return useQuery({
    queryKey: [...ROSTER_KEY, activeConnectionId],
    queryFn: async () => {
      // Rich rows (last_session, ui_meta, has_avatar) come from the ACTIVE
      // gateway's profiles.list — unchanged single-source behavior.
      const pins = preferredSessionIds($botMeta.get())
      const local = await host.request(
        'profiles.list',
        Object.keys(pins).length ? { preferred_session_ids: pins } : {}
      )
      // Newer backends inject the teammate-messaging protocol into every
      // session's system prompt (agent.bot_mode_protocol) — SOUL.md must not
      // carry a second copy. Older gateways lack the flag: keep appending.
      serverInjectsProtocol = Boolean(local?.bot_mode_protocol)

      // Multi-source desktops (work4you #86875) also expose the union
      // agent roster across every registered connection. Merge agents from
      // OTHER sources in as additional rows. Feature-detected + best-effort:
      // an older Desktop build (no host.agents) or a roster hiccup leaves
      // the local list exactly as it was.
      if (typeof host.agents === 'function') {
        try {
          const union = await host.agents()
          return mergeMultiSourceRoster(local, union, activeConnectionId, $lastRoster.get())
        } catch {
          /* older build or roster failure — single-source list stands */
        }
      }

      return local
    },
    refetchInterval: poll ? 5000 : false,
    staleTime: 5000,
    // Remote (SSH) gateways connect slowly and drop on sleep/wake; keep
    // retrying instead of latching a terminal error card.
    retry: true,
    retryDelay: attempt => Math.min(15000, 1000 * 2 ** attempt)
  })
}

/** Merge the union agent roster (host.agents) over the active gateway's
 *  profiles.list. Active-source rows — matched by the LIVE connection id,
 *  falling back to the roster's primaryConnectionId, then the legacy
 *  kind==='local' rule on older desktops — are the agents profiles.list
 *  already returned: they only ANNOTATE the rich rows (handle, connection
 *  fields); rich fields stay authoritative and they are NOT duplicated.
 *  Rows from other sources become new roster entries tagged with their
 *  source label so BotRow can badge them and route open/warm through
 *  ensureAgent/warmAgent. Pure — exercised directly by the tests. */
function mergeMultiSourceRoster(local, union, activeConnectionId, previous = []) {
  const localProfiles = Array.isArray(local?.profiles) ? local.profiles : []
  const agents = Array.isArray(union?.agents) ? union.agents : []
  // A live id of null/'' means the window is on the unscoped local backend
  // (legacy hosts reported null for mode:'local'; the SDK now reports
  // 'local'). Do NOT fall back to registry primary when the third argument
  // was passed — primary can still say "spark" after the user clicked a
  // local bot, which skipped every Spark row as "active" and invented a
  // This-device shadow of default.
  const liveProvided = arguments.length >= 3
  const liveId = String(activeConnectionId || '').trim()
  let activeId = liveId || (liveProvided ? '' : String(union?.primaryConnectionId || '').trim())

  // Migrated remote-primary windows can still expose a legacy remote
  // descriptor without connectionId. That produces a null live id even
  // though profiles.list is answering from the registry primary. Infer the
  // primary only when its inventory matches the rich rows and the local
  // inventory does not. A genuinely local window has a matching local row,
  // so it keeps the null-is-local behavior used after clicking This device.
  if (!activeId && liveProvided) {
    const primaryId = String(union?.primaryConnectionId || '').trim()
    const richNames = new Set(localProfiles.map(profile => String(profile?.name || '').trim()).filter(Boolean))
    const localMatches = agents.some(
      agent => agent?.connectionKind === 'local' && richNames.has(String(agent?.profile || '').trim())
    )
    const primaryMatches = agents.some(
      agent => String(agent?.connectionId || '').trim() === primaryId && richNames.has(String(agent?.profile || '').trim())
    )

    if (!localMatches && primaryId && primaryMatches) {
      activeId = primaryId
    }
  }
  const activeByName = new Map()

  // Treat the rich list as one row per active-source profile. Clone every
  // row: some gateway clients reuse response objects, and annotating those in
  // place made each five-second refresh feed the previous union back into the
  // next merge, growing duplicate source rows indefinitely.
  for (const profile of localProfiles) {
    const name = String(profile?.name || '').trim()

    if (!name || profile?.remoteSource) {
      continue
    }

    if (profile?.sourceScoped && activeId && profile.connectionId !== activeId) {
      continue
    }

    if (!activeByName.has(name)) {
      activeByName.set(name, { ...profile, name })
    }
  }

  const profiles = [...activeByName.values()]

  // host.agents is an Electron/main-process capability. Defend the plugin
  // boundary too: older shells or reconnect races can still hand us repeated
  // identities even after the core roster deduplicates them.
  const seenSources = new Set()

  for (const agent of agents) {
    const profile = String(agent?.profile || '').trim()
    const connectionId = String(agent?.connectionId || '').trim()
    const sourceKey = `${connectionId}::${profile || 'default'}`

    if (!profile || seenSources.has(sourceKey)) {
      continue
    }

    seenSources.add(sourceKey)

    // The union enumerates EVERY registered connection, including the active
    // gateway that already answered profiles.list. Without this the active
    // gateway's own agents (connectionKind 'remote' on a remote-primary
    // desktop) would be appended as phantom duplicates — every bot listed
    // twice. Older Electron builds predate the connection ids; fall back to
    // the legacy local-source rule so single-source behavior stays intact.
    const isActiveSource = activeId ? connectionId === activeId : agent.connectionKind === 'local'
    const row = isActiveSource ? activeByName.get(profile) : null

    if (row) {
      // Annotate in place: the @name-device handle only differs from the
      // bare name when the profile exists on several sources.
      row.handle = agent.handle
      row.connectionId = agent.connectionId
      row.connectionKind = agent.connectionKind
      row.connectionLabel = agent.connectionLabel
      row.sourceScoped = true
      continue
    }

    if (isActiveSource) {
      // Union saw an active-source profile profiles.list didn't return (older
      // backend mid-refresh) — skip rather than invent a thin row.
      continue
    }

    profiles.push({
      name: profile,
      handle: agent.handle,
      connectionId,
      connectionKind: agent.connectionKind,
      connectionLabel: agent.connectionLabel,
      remoteSource: true,
      sourceScoped: true
    })
  }

  // SSH sources drop to connect-on-demand the moment their tunnel is not
  // the live gateway. Keep previously painted remote rows so clicking the
  // local agent does not empty Bot Mode.
  if (Array.isArray(previous) && previous.length > 0) {
    const present = new Set(profiles.map(row => `${row.connectionId || ''}::${row.name}`))
    const unionSourceIds = new Set(agents.map(agent => String(agent?.connectionId || '').trim()).filter(Boolean))
    const omitted = new Set(
      (Array.isArray(union?.sources) ? union.sources : [])
        .filter(source => source?.error === 'connect-on-demand' || source?.reachable === false)
        .map(source => String(source.connectionId || '').trim())
        .filter(Boolean)
    )

    const registered = new Set(
      (Array.isArray(union?.sources) ? union.sources : [])
        .map(source => String(source?.connectionId || '').trim())
        .filter(Boolean)
    )

    for (const row of previous) {
      const connectionId = String(row?.connectionId || '').trim()
      const name = String(row?.name || '').trim()
      const key = `${connectionId}::${name || 'default'}`

      if (!row?.remoteSource || !connectionId || !name || present.has(key)) {
        continue
      }

      if (registered.size > 0 && !registered.has(connectionId)) {
        continue
      }

      if (omitted.has(connectionId) || !unionSourceIds.has(connectionId)) {
        profiles.push({ ...row, remoteSource: true, sourceScoped: true })
        present.add(key)
      }
    }
  }

  return { ...local, profiles }
}

/** The @handle users tag a bot with. Multi-source rosters precompute the
 *  handle (bare name, or name-device when the profile exists on several
 *  registered sources) — prefer it when present. The primary profile's
 *  callable alias is 'work4you' — the mention middleware resolves it back to
 *  'default' — so the word 'default' never surfaces in the UI. */
function botHandle(name, bot) {
  if (bot?.handle && bot.handle !== name) {
    return bot.handle
  }

  return (name || '').trim().toLowerCase() === 'default' ? 'work4you' : name
}

function isActiveRosterBot(bot, active) {
  const activeName = String(active?.name || 'default').trim() || 'default'
  const activeId = String(active?.connectionId || '').trim()
  const botId = String(bot?.connectionId || '').trim()
  const botName = String(bot?.name || '').trim() || 'default'

  if (bot?.remoteSource) {
    return Boolean(activeId) && activeId === botId && botName === activeName
  }

  if (activeId && activeId !== 'local' && botId && activeId !== botId) {
    return false
  }

  return botName === activeName
}

/** Resolve @handles in prose against the Bot Mode roster (local + Connections).
 *  Skips the bot already speaking in this chat. Unique bare names match;
 *  duplicate names require the @name-device handle. */
function resolveRosterMentions(text, roster, active = {}) {
  const members = Array.isArray(roster) ? roster : []
  const prose = String(text || '').replace(/```[\s\S]*?```/g, ' ').replace(/`[^`\n]*`/g, ' ')
  const byForm = new Map()

  for (const bot of members) {
    if (!bot?.name || isActiveRosterBot(bot, active)) {
      continue
    }

    const handle = String(botHandle(bot.name, bot) || '').toLowerCase()
    const name = String(bot.name || '').toLowerCase()
    const forms = new Set([handle, name])

    if (bot.handle) {
      forms.add(String(bot.handle).toLowerCase())
    }

    for (const form of forms) {
      if (!form) {
        continue
      }

      const existing = byForm.get(form)

      if (existing && existing !== bot) {
        byForm.set(form, null)
        continue
      }

      if (!existing) {
        byForm.set(form, bot)
      }
    }
  }

  const mentioned = []
  const seen = new Set()

  for (const match of prose.matchAll(/(^|\s)@([a-z0-9][a-z0-9_-]*)/gi)) {
    let token = match[2].toLowerCase()

    if (token === 'work4you') {
      token = byForm.has('work4you') ? 'work4you' : token
    }

    const bot = byForm.get(token)

    if (!bot) {
      continue
    }

    const key = botRosterKey(bot)

    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    mentioned.push(bot)
  }

  return mentioned
}

const REMOTE_DM_TIMEOUT_MS = 180000
const REMOTE_DM_POLL_MS = 2000

/** The remote bot's canonical Bot Chat: pinned stored-id from its profile's
 *  ui_meta first, then resume-by-title, then create. Mirrors
 *  ensureGroupChatSession so DMs land in the ONE forever-chat instead of
 *  minting a fresh "Bot Chat" per mention. */
async function ensureRemoteCanonicalChat(route, profile) {
  let pinned = null

  try {
    const listed = await host.requestProfile(route, 'profiles.list', {})
    const owner = listed?.profiles?.find(p => p.name === profile)
    pinned = owner?.ui_meta?.['work4you-bots']?.chat || null
  } catch {
    /* older remote gateway — title lookup below still works */
  }

  for (const target of [pinned, 'Bot Chat']) {
    if (!target) {
      continue
    }

    try {
      const res = await host.requestProfile(route, 'session.resume', {
        session_id: target,
        profile,
        omit_messages: true
      })

      if (res?.session_id) {
        return { runtime: res.session_id, stored: res.session_key || pinned }
      }
    } catch {
      /* fall through */
    }
  }

  const created = await host.requestProfile(route, 'session.create', {
    profile,
    title: 'Bot Chat',
    // Bot Mode sessions are always hidden from the global sidebar.
    hidden: true
  })

  return { runtime: created?.session_id || null, stored: created?.stored_session_id || null }
}

/** Bounded reply poll on the recipient's session — same shape as a group
 *  member turn: wait for a NEW assistant message after `before`, or time out. */
async function pollRemoteDmReply(route, profile, sessionRef, before) {
  const deadline = Date.now() + REMOTE_DM_TIMEOUT_MS

  while (Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, REMOTE_DM_POLL_MS))

    let state = null

    try {
      state = await host.requestProfile(route, 'session.resume', { session_id: sessionRef, profile })
    } catch {
      continue
    }

    const messages = Array.isArray(state?.messages) ? state.messages : []
    const done = !state?.inflight && !state?.running

    if (messages.length > before && done) {
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i]

        if (msg?.role === 'assistant') {
          const text = typeof msg.content === 'string'
            ? msg.content
            : Array.isArray(msg.content)
              ? msg.content.map(p => (typeof p === 'string' ? p : p?.text || '')).join('')
              : msg?.text || ''

          return String(text).trim() || null
        }
      }

      return null
    }
  }

  return null
}

/** Deliver a user mention to bots on OTHER connections: into each bot's
 *  canonical Bot Chat, with the standard sender-attribution prefix (so the
 *  recipient's messaging protocol recognizes an agent-to-agent message), then
 *  relay the reply back as a notification. Sequential and fire-and-forget
 *  from the composer's perspective. */
async function deliverRemoteRosterMentions(bots, userText, sender) {
  const text = String(userText || '').trim()

  if (!text || typeof host.requestProfile !== 'function') {
    return
  }

  const senderName = String(sender?.name || 'the user').trim()
  const senderHandle = String(sender?.handle || senderName).trim()

  for (const bot of bots) {
    const connectionId = String(bot?.connectionId || '').trim()
    const profile = String(bot?.name || '').trim() || 'default'

    if (!connectionId || connectionId === 'local') {
      continue
    }

    const route = { connectionId, mode: 'remote', profile, targetProfile: profile }
    const label = bot.connectionLabel || connectionId

    try {
      const { runtime, stored } = await ensureRemoteCanonicalChat(route, profile)

      if (!runtime) {
        throw new Error(tr('remote.noSession'))
      }

      // Baseline before our submit, so the poll can spot the NEW reply.
      let before = 0

      try {
        const pre = await host.requestProfile(route, 'session.resume', { session_id: stored || runtime, profile })
        before = Array.isArray(pre?.messages) ? pre.messages.length : pre?.message_count || 0
      } catch {
        /* lazy session — zero messages */
      }

      // The delivery prefix is the recipient's cue that an agent (not its
      // human) is talking — same contract as the local CLI handoff.
      await host.requestProfile(route, 'prompt.submit', {
        session_id: runtime,
        text: `Message from \u{1F916} ${senderName} (@${senderHandle}): ${text}`
      })
      host.notify?.({
        kind: 'info',
        title: displayName(bot),
        message: tr('remote.messaged', botHandle(profile, bot), label)
      })

      const reply = await pollRemoteDmReply(route, profile, stored || runtime, before)

      if (reply) {
        host.notify?.({
          kind: 'info',
          title: `\u{1F916} ${displayName(bot)} (${label})`,
          message: reply.slice(0, 500)
        })
      } else {
        host.notify?.({
          kind: 'info',
          title: displayName(bot),
          message: tr('remote.noReply', botHandle(profile, bot), label)
        })
      }
    } catch (error) {
      host.notifyError?.(error, tr('remote.reachFailed', label))
    }
  }
}

/** Source-qualified identity for a roster row — the React list key AND the
 *  cross-surface roster identity. Names alone are NOT unique in a
 *  multi-source roster (two connections can both expose 'default');
 *  duplicate keys make React reconciliation repeat whole blocks of the list
 *  on every poll repaint (the Aug 2026 dupe-bots smear). */
function botRosterKey(bot) {
  return `${bot?.connectionId || 'legacy'}::${bot?.name || 'default'}`
}

// ── cross-connection routing ─────────────────────────────────────────────────
// A bot from another registered connection (remoteSource rows) is reached
// through host.requestProfile with a route descriptor; local bots keep the
// active-gateway door. Feature-detected: older desktops without
// requestProfile simply have no remote routes (callers fall back / disable).

/** Route descriptor for a bot on another connection, or null for the local /
 *  active source (or when the desktop can't route). */
function botConnectionRoute(bot) {
  const id = String(bot?.connectionId || '').trim()

  if (!bot?.remoteSource || !id || id === 'local' || typeof host.requestProfile !== 'function') {
    return null
  }

  const profile = String(bot?.name || '').trim() || 'default'

  return { connectionId: id, mode: 'remote', profile, targetProfile: profile }
}

/** Gateway RPC on the bot's OWN source: requestProfile for remote rows,
 *  the active gateway for local ones. Never activates/foregrounds. */
async function requestForBot(bot, method, params = {}) {
  const route = botConnectionRoute(bot)

  if (route) {
    return host.requestProfile(route, method, params)
  }

  return host.request(method, params)
}

/** Stable per-member identity inside a group room. Local members keep their
 *  bare name (compat with rooms persisted before cross-connection groups);
 *  remote members get the source-qualified key so `dixie` on the Mini and a
 *  local `dixie` never share watermarks or sessions. */
function groupMemberKey(member) {
  return member?.remoteSource ? botRosterKey(member) : member?.name
}

// Bot metadata is scoped to the active gateway until the server exposes a
// union of rich profile rows. Never paint that metadata onto a thin row from
// another source: two `default` agents must not borrow each other's title,
// pin, avatar, group, unread state, or canonical-chat pointer.
function botRosterMeta(bot, metaByName) {
  return bot?.remoteSource ? null : metaByName?.[bot?.name]
}

function showsHandle(name, meta, bot) {
  const display = displayName({ name }, meta)
  return Boolean(name && display.toLowerCase() !== botHandle(name, bot).toLowerCase())
}

// ── canonical bot chat ───────────────────────────────────────────────────────
// Each bot has ONE forever chat, pinned by stored-session id in bot meta
// (meta.chat — synced server-side via ui_meta, so it follows the profile).
// Opening a bot ALWAYS lands there: never "most recent session", which
// drifts whenever the profile is used from the CLI, Sessions mode, or a
// cronjob. The pin only changes through explicit adoption:
//   - grandfather: first open of a bot that already has history pins its
//     current latest session, so continuity starts from the chat in use
//   - fresh bot: opens a draft; when the first message persists a stored
//     session, we adopt that id (empty sessions are pruned server-side, so
//     pre-creating one at enable time is not possible)
//   - recovery: if the pinned id vanishes from the DB (compaction rewrote
//     the lineage), re-pin the newest session carrying the canonical title.

// In-flight creations, keyed by bot name — double-clicking a row must not
// mint two canonical chats.
const canonicalCreations = new Map()
let botOpenGeneration = 0

async function openStoredBotChat(name, storedId, summary) {
  if (!storedId || typeof host.openSession !== 'function') {
    throw new Error(tr('sessions.cannotOpenStored'))
  }

  const hasAuthoritativeCount =
    typeof summary?.message_count === 'number' && Number.isFinite(summary.message_count)
  const expectHistory = hasAuthoritativeCount ? summary.message_count > 0 : true

  // A profile backend that just woke up can lose the hydration-timeout race
  // even though the session is fine (work4you#89617) — clicking Retry
  // succeeds because the backend is warm by then. retryHydrationTimeoutOnce
  // asks the SDK layer to retry that same wait internally, BEFORE it arms the
  // core stranded-session overlay: a plugin-side retry can't do this because
  // only host.openSession sees the resume-exhausted latch that overlay reads.
  await host.openSession(storedId, {
    profile: name,
    intent: 'main',
    awaitHydration: true,
    expectHistory,
    keepAllProfilesScope: true,
    retryHydrationTimeoutOnce: true
  })

  return storedId
}

/** Create the bot's ONE forever chat: a real session opened with a kickoff
 *  message (the gateway prunes zero-message sessions, so the chat is born
 *  with the bot introducing itself). Pins the stored id in bot meta and
 *  returns it. `createRuntime` pins provider/model on session.create so the
 *  first agent build does not resolve `auto` against an empty Fresh profile. */
function createCanonicalChat(name, createRuntime) {
  const inflight = canonicalCreations.get(name)

  if (inflight) {
    return inflight
  }

  const run = (async () => {
    const pinnedProvider = String(createRuntime?.provider || '').trim()
    const pinnedModel = String(createRuntime?.model || '').trim()
    const res = await host.request('session.create', {
      profile: name,
      title: 'Bot Chat',
      // Always born hidden from the global sidebar — Bot Mode sessions are
      // plugin-owned. Core applies this via the generic `hidden` flag
      // (deferred as pending_hidden until the row exists); older gateways
      // ignore the unknown param and it stays visible.
      hidden: true,
      ...(pinnedProvider && pinnedModel ? { provider: pinnedProvider, model: pinnedModel } : {})
    })
    const sid = res?.stored_session_id
    const runtime = res?.session_id

    if (sid) {
      saveBotMeta(name, { chat: sid })
    }

    // Mount the session view FIRST, then send the kickoff — submitting into
    // an unmounted session left the intro reply invisible until reopen.
    let opened = false

    if (sid && typeof host.openSession === 'function') {
      try {
        await host.openSession(sid, { profile: name, intent: 'main', keepAllProfilesScope: true })
        opened = true
      } catch {
        // The stored row may not exist until the kickoff persists it. Retry
        // after prompt.submit below instead of leaving the chat off-screen.
      }
    }

    if (runtime) {
      await new Promise(resolve => window.setTimeout(resolve, 400))

      try {
        await host.request('prompt.submit', { session_id: runtime, text: tr('create.canonicalKickoff') })

        if (!opened && sid && typeof host.openSession === 'function') {
          await host.openSession(sid, { profile: name, intent: 'main', keepAllProfilesScope: true })
        }
      } catch {
        // The chat already exists. Keep the pin so the next click
        // opens it instead of making a second Bot Chat.
      }
    }

    return sid || null
  })().finally(() => canonicalCreations.delete(name))

  canonicalCreations.set(name, run)

  return run
}

/** Open the bot's ONE forever chat and return the opened id (or the pin).
 *
 *  Identity rules (work4you#88200 — the row must open the session its
 *  preview describes):
 *  - grandfather: no pin + existing history adopts the previewed session
 *    (`history`, the roster's last_session for this bot) instead of minting
 *    a new empty chat;
 *  - a live pin is verified through the backend's precise preferred_session
 *    resolver (hidden rows still resolve; compression lineages resolve to
 *    the live tip) — never inferred from a paginated, hidden-excluding
 *    session.list window, which misjudged real hidden pins as gone;
 *  - transient lookup failures keep the pin: try the stored id as-is, and
 *    only a rejected open enters recovery. */
async function openBotCanonicalChat(name, pinned, history) {
  if (!pinned) {
    // Grandfather: adopt the conversation the row already previews.
    const adoptId = history?.id
    if (adoptId && typeof host.openSession === 'function') {
      await openStoredBotChat(name, adoptId, history)
      saveBotMeta(name, { chat: adoptId })
      return adoptId
    }
    return createCanonicalChat(name)
  }

  // Precise verification. An older gateway ignores the unknown param and
  // omits the key — that reads as a lookup failure below, NOT as a missing
  // session, so legacy backends keep the try-as-is escape hatch.
  let preferred
  let lookupFailed = false
  try {
    const res = await host.request('profiles.list', {
      include_sessions: true,
      preferred_session_ids: { [name]: pinned }
    })
    const row = (res?.profiles ?? []).find(p => p.name === name)
    preferred = row?.preferred_session
    if (preferred === undefined) {
      lookupFailed = true
    }
  } catch {
    lookupFailed = true
  }

  if (lookupFailed) {
    // Transient gateway state (or an older backend): the pin is innocent
    // until proven guilty — try it as-is. A rejected open is still ambiguous:
    // it can be the same reconnect/hydration outage that broke this lookup, so
    // preserve the forever-chat pin and surface Retry instead of forking it.
    return openStoredBotChat(name, pinned, history)
  }

  if (preferred) {
    try {
      await openStoredBotChat(name, preferred.resolved_id || preferred.id, preferred)
      return pinned
    } catch (error) {
      // The precise lookup JUST confirmed this session exists, so a failed
      // open is transient (reconnect, backend restart). Clearing the pin or
      // minting a replacement here would fork the bot's forever-chat on
      // every hiccup — report and keep everything as it is.
      throw error
    }
  }

  // Definitively gone (db reset, or the lineage was rewritten past
  // recovery): re-anchor on the previewed session when there is one.
  const recoveryId = history?.id
  if (recoveryId && typeof host.openSession === 'function') {
    await openStoredBotChat(name, recoveryId, history)
    saveBotMeta(name, { chat: recoveryId })
    return recoveryId
  }
  saveBotMeta(name, { chat: null })
  return createCanonicalChat(name)
}

async function prepareBotSource(bot, pinnedChat) {
  if (!bot.sourceScoped) {
    return pinnedChat
  }

  if (typeof host.ensureAgent !== 'function') {
    throw new Error(tr('remote.updateDesktop'))
  }

  await host.ensureAgent(bot.connectionId, bot.name)

  if (!bot.remoteSource) {
    return pinnedChat
  }

  const liveId = String(typeof host.activeConnectionId === 'function' ? host.activeConnectionId() || '' : '').trim()
  const targetId = String(bot.connectionId || '').trim()

  if (targetId && targetId !== 'local' && liveId !== targetId) {
    throw new Error(tr('remote.stillOn', liveId || tr('remote.thisDevice'), bot.connectionLabel || targetId))
  }

  // Thin rows deliberately omit metadata from the active source. Once their
  // owner is active, recover that source's canonical-chat pointer so
  // same-named agents never reuse or overwrite each other's pin.
  try {
    const refreshed = await host.request('profiles.list', {})
    const owner = refreshed?.profiles?.find(profile => profile.name === bot.name)

    return owner?.ui_meta?.['work4you-bots']?.chat || null
  } catch {
    // Metadata refresh is best-effort; canonical creation remains the fallback.
    return null
  }
}

function displayName(bot, meta) {
  // Only THIN rows from another source trade the friendly name for their
  // connection label — the active gateway's own default must keep reading
  // "Work4You". Annotated active rows carry sourceScoped too, and keying this
  // off sourceScoped renamed the user's main agent to an IP-derived label
  // (community report, Aug 17 2026).
  if (bot?.remoteSource && (bot.name || '').trim().toLowerCase() === 'default' && bot.connectionLabel) {
    return bot.connectionLabel
  }

  if (meta?.title?.trim()) {
    return meta.title.trim()
  }

  // Core-profile display name (profile.yaml, set via `work4you profile rename
  // default <name>` or the dashboard) — the CLI-level equivalent of a Bot
  // Mode title. Rides the profiles.list row; presentation-only.
  if (typeof bot?.display_name === 'string' && bot.display_name.trim()) {
    return bot.display_name.trim()
  }

  // The primary profile is literally named "default" — as a bot identity
  // that reads like nobody bothered. Present it as Work4You (the agent it is)
  // unless the user gives it a real title.
  if ((bot.name || '').trim().toLowerCase() === 'default' && !bot.title) {
    return 'Work4You'
  }

  const raw = (bot.title || bot.name || '').replace(/[-_]+/g, ' ').trim()
  return raw.replace(/\b\w/g, ch => ch.toUpperCase())
}

/** Filter by the two stable identities rendered in every roster row: the
 * customizable display name and the profile's @handle. Keep the current
 * activity order — search narrows the roster, it never re-ranks it. */
function filterBots(roster, metaByName, query) {
  const needle = query.trim().toLowerCase().replace(/^@/, '')

  if (!needle) {
    return roster
  }

  return roster.filter(bot => {
    const display = displayName(bot, botRosterMeta(bot, metaByName)).toLowerCase()
    const profile = (bot.name || '').toLowerCase()
    const handle = botHandle(bot.name, bot).toLowerCase()
    // Multi-source rows also match on their device name ("homelab" finds
    // every bot living on the Homelab connection).
    const sourceLabel = (bot.connectionLabel || '').toLowerCase()
    return (
      display.includes(needle) || profile.includes(needle) || handle.includes(needle) || sourceLabel.includes(needle)
    )
  })
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
}

/** Flatten markdown syntax out of a one-line roster preview so rows read
 *  like Discord's — no raw **bold**, `code`, > quotes, or [link](url)
 *  characters in the preview line. */
function stripPreviewMarkdown(text) {
  return String(text || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`\n]*)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(^|\s)[*_](\S(?:.*?\S)?)[*_](?=\s|$|[.,;:!?])/g, '$1$2')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Canonical multi-group read with legacy scalar compatibility. Profiles that
 *  predate `groups` still fall back to `group`; once the canonical array exists,
 *  it is authoritative. Writes keep `group` as a first-membership projection so
 *  older desktops can still display one room without corrupting the array. */
function botGroups(meta) {
  const groups = []
  const seen = new Set()
  const values = Array.isArray(meta?.groups) ? meta.groups : [meta?.group]

  for (const value of values) {
    if (typeof value !== 'string') {
      continue
    }

    const group = value.trim()

    if (group && !seen.has(group)) {
      seen.add(group)
      groups.push(group)
    }
  }

  return groups
}

function groupMembershipPatch(meta, group, enabled) {
  const name = String(group || '').trim()
  let groups = botGroups(meta)

  if (enabled) {
    if (name && !groups.includes(name)) {
      groups = [...groups, name]
    }
  } else {
    groups = groups.filter(existing => existing !== name)
  }

  return { groups, group: groups[0] || null }
}

/** Group chats that should hold a roster row: every group named in bot meta
 *  (local members) plus every room record that still has stored members or
 *  log — cross-connection rooms whose members can't ride bot-meta.
 *
 *  When `roster` is provided, meta-only names with nobody seated (and no
 *  room content) are dropped — otherwise a stale `$botMeta` key after bots
 *  leave/delete keeps an empty "0 bots" row that Disband already cleared. */
function groupChatNames(metaByName, rooms, roster) {
  const names = new Set()

  for (const name of knownGroups(metaByName)) {
    if (
      roster === undefined ||
      groupChatMemberBots(name, roster, metaByName).length > 0 ||
      (Array.isArray(rooms?.[name]?.members) && rooms[name].members.length) ||
      (Array.isArray(rooms?.[name]?.log) && rooms[name].log.length)
    ) {
      names.add(name)
    }
  }

  for (const [name, room] of Object.entries(rooms || {})) {
    if ((Array.isArray(room?.members) && room.members.length) || (Array.isArray(room?.log) && room.log.length)) {
      names.add(name)
    }
  }

  return [...names]
}

/** Millisecond timestamp of a room's newest log entry (0 for a silent room) —
 *  the group's recency key, competing in the same ordering as bot rows. */
function groupLastActivity(room) {
  const log = Array.isArray(room?.log) ? room.log : []

  return log.length ? log[log.length - 1].at || 0 : 0
}

/** Seat a group's member roster: local bots whose meta names the group, plus
 *  the room record's stored descriptors (remote members can't ride bot-meta).
 *  Prefers the LIVE roster row for a stored descriptor when present. */
function groupChatMemberBots(group, roster, metaByName) {
  const local = (roster || []).filter(
    bot => !bot.remoteSource && botGroups(botRosterMeta(bot, metaByName)).includes(group)
  )
  const stored = ($groupChats.get()[group] || {}).members || []
  const seated = new Set(local.map(botRosterKey))
  const remote = []

  for (const descriptor of stored) {
    const key = botRosterKey(descriptor)

    if (seated.has(key)) {
      continue
    }

    seated.add(key)
    remote.push((roster || []).find(bot => botRosterKey(bot) === key) || descriptor)
  }

  return [...local, ...remote]
}

/** Persist source-qualified identities for every selected member. The active
 *  source's row may become remote after a connection switch, so retaining it
 *  here is what keeps the same room intact across machines. */
function durableGroupChatMembers(bots) {
  return (bots || []).map(bot => ({
    name: bot.name,
    handle: bot.handle || bot.name,
    connectionId: bot.connectionId,
    connectionKind: bot.connectionKind,
    connectionLabel: bot.connectionLabel,
    remoteSource: true,
    sourceScoped: true
  }))
}

/** Existing group names, alphabetical — feeds the Manage-groups dialog. */
function knownGroups(metaByName) {
  const names = new Set()

  for (const meta of Object.values(metaByName || {})) {
    for (const group of botGroups(meta)) {
      names.add(group)
    }
  }

  return [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}

// ── group chats: bounded round-robin coordination over a shared room log ─────
//
// Behavioral model (clean-room): a group conversation is ONE ordered room log
// owned by the plugin. A user send triggers at most GROUP_CHAT_MAX_ROUNDS
// serial round-robin rounds over the member roster — never parallel, no LLM
// router. Who speaks each round is a deterministic @mention parse since the
// last user message (mentioned members only, else everyone); whether a member
// actually speaks is its own turn's choice — replying with exactly "(pass)"
// (or nothing, or failing) is silence. Hard caps end every turn; a round in
// which everyone passed means the conversation settled. Each member runs its
// turn in its OWN persistent per-group Work4You session and is fed only the
// room messages that are NEW since it last saw the room.

const GROUP_CHAT_MAX_ROUNDS = 3
const GROUP_CHAT_MAX_MESSAGES = 10
const GROUP_CHAT_HISTORY_LIMIT = 24
const GROUP_CHAT_MAX_MEMBERS = 6

/** "(pass)" (loosely: pass / (pass) / pass.) or empty = the member stayed silent. */
function isGroupPassText(text) {
  const trimmed = String(text || '').trim()

  if (!trimmed) {
    return true
  }

  return /^\(?\s*pass\s*\)?\.?$/i.test(trimmed)
}

/** Deterministic @mention parse. Handles @name, @"two words" via display
 *  titles, and @everyone/@all. Names match case-insensitively against member
 *  profile names, display titles, and collapsed no-space forms. */
function parseGroupChatMentions(text, members) {
  const source = String(text || '')
  const mentioned = new Set()
  let everyone = false
  const handles = new Map()

  for (const member of members) {
    const title = String(member.title || '').trim()
    // Cross-connection members are also addressable by their @name-device
    // handle (the roster's disambiguated form) — same-named agents on two
    // machines resolve to the right one.
    const handle = String(member.handle || botHandle(member.name, member) || '').trim()
    const forms = new Set([
      member.name.toLowerCase(),
      member.name.toLowerCase().replace(/[\s_-]+/g, ''),
      ...(handle ? [handle.toLowerCase(), handle.toLowerCase().replace(/[\s_-]+/g, '')] : []),
      ...(title
        ? [title.toLowerCase(), title.toLowerCase().replace(/[\s_-]+/g, ''), title.split(/\s+/)[0].toLowerCase()]
        : [])
    ])

    for (const form of forms) {
      if (form) {
        handles.set(form, groupMemberKey(member))
      }
    }
  }

  for (const match of source.matchAll(/@([a-z0-9][a-z0-9._-]*)/gi)) {
    const handle = match[1].toLowerCase()

    if (handle === 'everyone' || handle === 'all') {
      everyone = true
      continue
    }

    if (handle === 'user') {
      continue
    }

    const resolved = handles.get(handle) || handles.get(handle.replace(/[._-]+/g, ''))

    if (resolved) {
      mentioned.add(resolved)
    }
  }

  return { everyone, mentioned }
}

/** Members that should take a turn this round: everyone when no member is
 *  @-mentioned in messages since the last user entry (or @everyone appears),
 *  otherwise only the mentioned members. Recomputed every round so a member
 *  pulled in mid-conversation joins the next round. */
function resolveGroupResponders(log, members) {
  let sinceLastUser = []

  for (let i = log.length - 1; i >= 0; i--) {
    if (log[i].from.kind === 'user') {
      sinceLastUser = log.slice(i)
      break
    }
  }

  const mentioned = new Set()
  let everyone = false

  for (const entry of sinceLastUser) {
    const parsed = parseGroupChatMentions(entry.text, members)

    if (parsed.everyone) {
      everyone = true
    }

    for (const name of parsed.mentioned) {
      mentioned.add(name)
    }
  }

  if (everyone || mentioned.size === 0) {
    return members
  }

  return members.filter(member => mentioned.has(groupMemberKey(member)))
}

/** Rotate the roster so a different member leads each round. */
function rotateGroupSpeakers(members, round) {
  if (members.length < 2) {
    return members
  }

  const shift = round % members.length

  return [...members.slice(shift), ...members.slice(0, shift)]
}

/** Transcript form of a room speaker's profile name. The primary profile is
 *  literally named "default" — render it as Work4You (matching displayName and
 *  the @work4you handle) so the main agent never loses its name in rooms. */
function groupSpeakerLabel(name) {
  return (name || '').trim().toLowerCase() === 'default' ? 'Work4You' : name
}

/** Room-log line as a member sees it: `Name (user): …` / `Name: …` /
 *  `Name (you): …`. */
function formatGroupChatLine(entry, viewerName) {
  // Attachments are staged into each member's session as real payloads; the
  // transcript line names them so the delta text and the bytes line up.
  const attached = Array.isArray(entry.images) && entry.images.length
    ? ` ${entry.images
        .map(img => {
          const label = img.kind === 'pdf' ? 'attached PDF' : img.kind === 'file' ? 'attached file' : 'attached image'
          return `[${label}: ${img.name || 'image'}]`
        })
        .join(' ')}`
    : ''

  if (entry.from.kind === 'user') {
    return `${entry.from.name || 'User'} (user): ${entry.text}${attached}`
  }

  const suffix = entry.from.name === viewerName ? ' (you)' : ''
  // Cross-connection speakers carry their device so same-named agents on
  // two machines stay tellable apart in every member's transcript.
  const source = entry.from.source ? ` [${entry.from.source}]` : ''

  return `${groupSpeakerLabel(entry.from.name)}${suffix}${source}: ${entry.text}${attached}`
}

/** The full per-turn payload for one member: participation rules + the room
 *  delta. Rules travel in the turn payload (not SOUL) so every existing bot
 *  can join a group chat without a profile migration. */
function buildGroupChatTurnPrompt({ groupName, members, viewer, deltaLines }) {
  const viewerKey = groupMemberKey(viewer)
  const peers = members.filter(m => groupMemberKey(m) !== viewerKey)
  const peerNames = peers
    .map(m => {
      const handle = m.title ? `${m.title} (@${botHandle(m.name, m)})` : `@${botHandle(m.name, m)}`
      return m.remoteSource ? `${handle} [on ${m.connectionLabel || m.connectionId}]` : handle
    })
    .join(', ')

  return [
    `[Group chat: "${groupName}"] You are @${botHandle(viewer.name, viewer)}, one participant in a group chat with ${peerNames || 'no one else yet'} and the user.`,
    '',
    'New messages in the room since your last turn (oldest first):',
    ...deltaLines.map(line => `  ${line}`),
    '',
    'Rules for this room:',
    '- Reply with ONE conversational message ONLY if you have something new worth adding: build on what was just said, claim or hand off work, answer a question aimed at you, or report a real result. Keep chatter short (1-3 sentences) — but when you are delivering a result, an answer the user asked for, or substantive work, give it at full quality and length; never thin out real content to fit the room.',
    '- If you have nothing new to add, reply with exactly "(pass)". Passing is good — it lets the conversation settle.',
    '- Mention a teammate as @name to pull them in; mention @user only for a judgment call or a result the user needs. Do not repeat points already made.',
    '- Never reveal content from your private 1:1 chats. Your reply text goes to the room verbatim — no preamble, no meta-commentary.'
  ].join('\n')
}

/** Trim a room log + its watermarks to the retained window, keeping
 *  watermark indices consistent with the trimmed array. */
function trimGroupChatLog(log, watermarks, limit = GROUP_CHAT_HISTORY_LIMIT * 4) {
  if (log.length <= limit) {
    return { log, watermarks }
  }

  const drop = log.length - limit
  const trimmed = {}

  for (const [name, index] of Object.entries(watermarks || {})) {
    trimmed[name] = Math.max(0, index - drop)
  }

  return { log: log.slice(drop), watermarks: trimmed }
}

/** Mutate one group's room state through the atom + persist the durable part. */
function updateGroupChat(group, mutate) {
  const all = { ...$groupChats.get() }
  const current = all[group] || { log: [], watermarks: {}, epoch: 0, running: false }
  const next = mutate({ ...current, log: [...current.log], watermarks: { ...current.watermarks } })
  const bounded = trimGroupChatLog(next.log, next.watermarks)

  next.log = bounded.log
  next.watermarks = bounded.watermarks
  all[group] = next
  $groupChats.set(all)

  try {
    const durable = {}

    for (const [name, room] of Object.entries(all)) {
      durable[name] = {
        log: room.log,
        watermarks: room.watermarks,
        sessions: room.sessions || {},
        // Timed-out turns awaiting a late reply — keyed by member, valued
        // with the pre-turn message baseline. Survives reloads so finished
        // work is still harvested after a window restart.
        stranded: room.stranded || {},
        // Source-qualified member descriptors keep the room whole when the
        // active connection changes and today's local members become remote.
        members: Array.isArray(room.members) ? room.members : [],
        // Room picture (small data URL, same normalization as bot avatars).
        image: room.image || null
      }
    }

    Promise.resolve(pluginCtx?.storage?.set?.('group-chats', durable)).catch(() => undefined)
  } catch {
    /* storage unavailable — room survives for this window only */
  }

  return next
}

/** Soft-disband a group chat: remove only this group from every local member's
 *  membership list (the metadata syncs cross-machine via ui_meta), drop the
 *  room log from the atom + plugin storage, and clear the selection if it was
 *  this room. Other group memberships and the members' per-group gateway
 *  sessions ("Group: <name>") are intentionally KEPT. */
async function disbandGroupChat(group, members) {
  // Invalidate any in-flight round-robin FIRST: bump the epoch so a running
  // drive bails at its next member boundary instead of appending to a room
  // the user just discarded.
  const all = { ...$groupChats.get() }
  const prior = all[group] || {}

  delete all[group]
  // Keep a runtime-only tombstone while a drive may still be mid-turn; it
  // carries no log and is never persisted, so it can't rehydrate.
  if (prior.running) {
    all[group] = { log: [], watermarks: {}, sessions: {}, epoch: (prior.epoch || 0) + 1, running: false }
  }

  $groupChats.set(all)

  // The center page falls back to its empty state; the user picks what's next.
  if ($groupChatWorkspace.get() === group) {
    selectGroupRoom(null)
  }

  const needs = { ...$groupNeedsYou.get() }

  delete needs[group]
  $groupNeedsYou.set(needs)

  // Persist the room map WITHOUT the disbanded room so it can't come back
  // on the next window load.
  try {
    const durable = {}

    for (const [name, room] of Object.entries($groupChats.get())) {
      if (name !== group && Array.isArray(room.log)) {
        durable[name] = {
          log: room.log,
          watermarks: room.watermarks,
          sessions: room.sessions || {},
          members: Array.isArray(room.members) ? room.members : [],
          image: room.image || null
        }
      }
    }

    await Promise.resolve(pluginCtx?.storage?.set?.('group-chats', durable))
  } catch {
    /* storage unavailable — the atom reset above still empties the room */
  }

  // Scrub this group from EVERY local bot-meta entry — not only the currently
  // seated `members` list. Orphaned keys (a bot removed via Manage groups, or
  // meta left behind after a profile delete race) otherwise keep the name in
  // knownGroups and the roster shows an empty "0 bots" row after Disband.
  // saveBotMeta never throws (local storage + best-effort profiles.configure),
  // so a flaky gateway can't strand the disband halfway with the room already gone.
  const metaByName = $botMeta.get()
  const toClear = new Set()

  for (const [name, meta] of Object.entries(metaByName)) {
    if (botGroups(meta).includes(group)) {
      toClear.add(name)
    }
  }

  for (const member of members || []) {
    if (member?.name && !member.remoteSource) {
      toClear.add(member.name)
    }
  }

  for (const name of toClear) {
    const meta = $botMeta.get()[name] || {}
    await saveBotMeta(name, groupMembershipPatch(meta, group, false))
  }
}

/** Set or clear a group chat's room picture (small data URL, normalized by
 *  the same pipeline as bot avatars). Persists with the room record. */
function setGroupChatImage(group, image) {
  updateGroupChat(group, room => {
    room.image = image || null
    return room
  })
}

/** Rename a group chat. The group's NAME is its identity everywhere — the
 *  room-map key, each local member's ui_meta membership list, and derived
 *  state — so a rename re-keys all of them. Member gateway sessions are kept
 *  as-is: stored sids keep resuming, so no history is lost (only a member
 *  whose sid is later lost falls back to a fresh "Group: <new name>" title
 *  lookup). Returns the new name, or null when the target name is taken. */
async function renameGroupChat(oldName, newName, members) {
  const next = String(newName || '').trim().slice(0, 64)

  if (!next || next === oldName) {
    return oldName
  }

  // Renames are explicit user intent: reject a collision honestly instead of
  // silently suffixing like creation does.
  const taken = new Set(Object.keys($groupChats.get()))

  for (const meta of Object.values($botMeta.get() || {})) {
    for (const existing of botGroups(meta)) {
      taken.add(existing)
    }
  }

  taken.delete(oldName)

  if (taken.has(next)) {
    host.notify({ kind: 'error', message: tr('groups.nameTaken', next) })
    return null
  }

  // Move the room record wholesale — log, watermarks, sessions, members,
  // picture, and runtime flags all belong to the same room under its new name.
  const all = { ...$groupChats.get() }
  const room = all[oldName]

  delete all[oldName]

  if (room) {
    all[next] = room
  }

  $groupChats.set(all)

  // The selection follows the room to its new identity right away, so the
  // open page never shows a room that is mid-move.
  if ($groupChatWorkspace.get() === oldName) {
    selectGroupRoom(next)
  }

  const needs = { ...$groupNeedsYou.get() }

  if (oldName in needs) {
    needs[next] = needs[oldName]
    delete needs[oldName]
    $groupNeedsYou.set(needs)
  }

  // Local memberships: swap the name inside each member's canonical groups
  // list (syncs cross-machine via ui_meta). Remote members' seating lives in
  // the room record we just moved.
  for (const member of members || []) {
    if (!member?.name || member.remoteSource) {
      continue
    }

    const meta = $botMeta.get()[member.name] || {}
    const groups = [...new Set(botGroups(meta).map(g => (g === oldName ? next : g)))]

    await saveBotMeta(member.name, { groups, group: groups[0] || null })
  }

  // Persist the re-keyed map (updateGroupChat writes the whole durable map).
  updateGroupChat(next, r => r)

  return next
}

function appendGroupChatEntry(group, from, text, thread, images) {
  const entry = { at: Date.now(), from, text: String(text).trim(), thread: thread || 'legacy' }

  if (Array.isArray(images) && images.length) {
    // [{ name, data }] — data URLs. Persisted with the room log so reloads
    // keep showing what the members were shown.
    entry.images = images
  }

  updateGroupChat(group, room => {
    room.log.push(entry)
    return room
  })

  // Needs-you: a member addressing @user badges the group's roster row —
  // unless that room is on screen, where the mention is already in view.
  const onScreen = $groupRoomViews.get() > 0 && $groupChatWorkspace.get() === group

  if (from.kind === 'member' && /@user\b/i.test(entry.text) && !onScreen) {
    $groupNeedsYou.set({ ...$groupNeedsYou.get(), [group]: true })
  }

  return entry
}

/** Ensure the member's per-group session exists and return a LIVE runtime
 *  session id for it. Gateway-native: session.create mints the session
 *  (lazy until its first message), session.resume by stored id — or by
 *  title, which also covers rehydrated rooms whose sid was lost — reopens
 *  it after restarts. Cross-connection members route to their OWN source
 *  via requestForBot; the window's gateway never switches. */
async function ensureGroupChatSession(group, member) {
  const title = `Group: ${group}`
  const room = $groupChats.get()[group] || {}
  const key = groupMemberKey(member)
  const known = room.sessions && room.sessions[key]

  // Try resuming what we know (stored sid first, then title lookup).
  for (const target of [known, title]) {
    if (!target || target === true) {
      continue
    }

    try {
      const res = await requestForBot(member, 'session.resume', {
        session_id: target,
        profile: member.name,
        omit_messages: true
      })

      if (res?.session_id) {
        return { runtime: res.session_id, stored: res.session_key || known }
      }
    } catch {
      /* fall through to create */
    }
  }

  const created = await requestForBot(member, 'session.create', {
    profile: member.name,
    title,
    // Room member sessions are plumbing — always hidden from the sidebar.
    hidden: true
  })
  const stored = created?.stored_session_id || null

  if (stored) {
    updateGroupChat(group, r => {
      r.sessions = { ...(r.sessions || {}), [key]: stored }
      return r
    })
  }

  return { runtime: created?.session_id || null, stored }
}

const GROUP_TURN_TIMEOUT_MS = 180000
const GROUP_TURN_POLL_MS = 2000
// A member turn that is VISIBLY still working (session reports
// inflight/running) keeps its slot alive up to this hard cap. The base
// timeout alone silently dropped long real turns: a 7-minute research run
// timed out at 3 minutes, read as a pass, and its finished result never
// reached the room (db's Aug 2026 report).
const GROUP_TURN_HARD_CAP_MS = 20 * 60000

/** One member turn, gateway-native: submit the room delta as a prompt into
 *  the member's per-group session, then poll the session until a NEW
 *  assistant message lands (or timeout → pass). While the session visibly
 *  reports work in flight the deadline extends (bounded by the hard cap),
 *  so slow models aren't cut off mid-run. A turn that still times out
 *  records a stranded marker so the finished reply can be harvested into
 *  the room at the member's next turn instead of being lost. */
async function runGroupChatMemberTurn(group, member, prompt, thread, images) {
  const { runtime, stored } = await ensureGroupChatSession(group, member)

  if (!runtime) {
    return null
  }

  recordGroupActivity(group, { kind: 'working', member: member.name, thread })

  // Baseline: how many messages exist before our submit.
  let before = 0

  try {
    const pre = await requestForBot(member, 'session.resume', {
      session_id: stored || runtime,
      profile: member.name
    })
    before = Array.isArray(pre?.messages) ? pre.messages.length : pre?.message_count || 0
  } catch {
    /* lazy session — zero messages */
  }

  // Stage this delta's attachments into the member's session so the model
  // receives the actual payload with the prompt — the same attach RPCs the
  // 1:1 chat uses (they also work cross-connection, where the member's
  // gateway can't see this machine's files). Images queue as vision tiles,
  // PDFs render per-page via pdf.attach, and other files materialize in the
  // session workspace (their @file: refs are appended to the prompt so the
  // member's file tools can read them). A failed attach degrades that
  // member to text-only; the transcript line still names the attachment so
  // the member knows something was shared.
  const fileRefs = []

  for (const img of Array.isArray(images) ? images : []) {
    if (!img || typeof img.data !== 'string' || !img.data) {
      continue
    }

    try {
      if (img.kind === 'pdf') {
        await requestForBot(member, 'pdf.attach', {
          session_id: runtime,
          content_base64: img.data,
          filename: img.name || 'attachment.pdf'
        })
      } else if (img.kind === 'file') {
        const res = await requestForBot(member, 'file.attach', {
          session_id: runtime,
          data_url: img.data,
          name: img.name || 'attachment'
        })

        if (res?.ref_text) {
          fileRefs.push(`${img.name || 'attachment'} → ${res.ref_text}`)
        }
      } else {
        await requestForBot(member, 'image.attach_bytes', {
          session_id: runtime,
          content_base64: img.data,
          filename: img.name || 'attachment.png'
        })
      }
    } catch {
      /* text-only fallback for this member */
    }
  }

  const turnText = fileRefs.length
    ? `${prompt}\n\nAttached files staged in your session workspace:\n${fileRefs.join('\n')}`
    : prompt

  await requestForBot(member, 'prompt.submit', { session_id: runtime, text: turnText })

  const started = Date.now()
  let deadline = started + GROUP_TURN_TIMEOUT_MS

  while (Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, GROUP_TURN_POLL_MS))

    let state = null

    try {
      state = await requestForBot(member, 'session.resume', {
        session_id: stored || runtime,
        profile: member.name
      })
    } catch {
      continue
    }

    const messages = Array.isArray(state?.messages) ? state.messages : []
    const busy = Boolean(state?.inflight || state?.running)
    const done = !busy

    if (messages.length > before && done) {
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i]

        if (msg?.role === 'assistant') {
          const text = typeof msg.content === 'string'
            ? msg.content
            : Array.isArray(msg.content)
              ? msg.content.map(p => (typeof p === 'string' ? p : p?.text || '')).join('')
              : msg?.text || ''
          const replyText = String(text).trim()

          recordGroupActivity(group, {
            kind: isGroupPassText(replyText) ? 'passed' : 'replied',
            member: member.name,
            thread
          })

          return replyText
        }
      }

      recordGroupActivity(group, { kind: 'passed', member: member.name, thread })

      return null
    }

    // Still visibly working: extend the deadline (never past the hard cap).
    if (busy) {
      deadline = Math.min(started + GROUP_TURN_HARD_CAP_MS, Math.max(deadline, Date.now() + GROUP_TURN_TIMEOUT_MS))
    }
  }

  // Timeout — reads as a pass, but remember the baseline + thread
  // (runtime-only) so the finished reply can be posted late into the RIGHT
  // thread instead of vanishing.
  recordGroupActivity(group, { kind: 'timed-out', member: member.name, thread })
  updateGroupChat(group, r => {
    r.stranded = { ...(r.stranded || {}), [groupMemberKey(member)]: { before, thread } }
    return r
  })

  return null
}

/** Post a timed-out member's finished reply into the room, if it landed
 *  after we stopped waiting. Called at the member's next turn boundary and
 *  on user sends, so long-running work is delivered late rather than lost. */
async function harvestStrandedGroupReply(group, member) {
  const memberKey = groupMemberKey(member)
  const room = $groupChats.get()[group] || {}
  const marker = room.stranded?.[memberKey]
  // Markers were a bare number before threads; normalize both shapes.
  const strandedBefore = typeof marker === 'number' ? marker : marker?.before
  const strandedThread = (typeof marker === 'object' && marker?.thread) || 'legacy'

  if (typeof strandedBefore !== 'number') {
    return
  }

  let state = null

  try {
    const stored = room.sessions?.[memberKey]
    state = await requestForBot(member, 'session.resume', {
      session_id: stored || `Group: ${group}`,
      profile: member.name
    })
  } catch {
    return // source unreachable — leave the marker for the next boundary
  }

  if (state?.inflight || state?.running) {
    return // still grinding — keep waiting
  }

  // Done (or dead): the marker is consumed either way.
  updateGroupChat(group, r => {
    const next = { ...(r.stranded || {}) }
    delete next[memberKey]
    r.stranded = next
    return r
  })

  const messages = Array.isArray(state?.messages) ? state.messages : []

  if (messages.length <= strandedBefore) {
    return
  }

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]

    if (msg?.role === 'assistant') {
      const text = typeof msg.content === 'string'
        ? msg.content
        : Array.isArray(msg.content)
          ? msg.content.map(p => (typeof p === 'string' ? p : p?.text || '')).join('')
          : msg?.text || ''
      const reply = String(text).trim()

      if (reply && !isGroupPassText(reply)) {
        recordGroupActivity(group, { kind: 'delivered', member: member.name, thread: strandedThread })
        appendGroupChatEntry(
          group,
          { kind: 'member', name: member.name, ...(member.remoteSource ? { source: member.connectionLabel || member.connectionId } : {}) },
          reply,
          strandedThread
        )
        updateGroupChat(group, r => {
          r.watermarks[`${strandedThread}::${memberKey}`] = r.log.length
          return r
        })
      }

      return
    }
  }
}

/** Drive one bounded round-robin turn for ONE THREAD. Serial — one member at
 *  a time. A newer user send bumps the room epoch; this loop notices at the
 *  next member boundary, bails, and the newest send's own loop takes over.
 *  Watermarks are per thread+member (`${thread}::${memberKey}`), so parallel
 *  topics never eat each other's deltas. */
async function runGroupChatRounds(group, members, thread) {
  const startEpoch = ($groupChats.get()[group] || {}).epoch || 0
  const isCurrent = () => (($groupChats.get()[group] || {}).epoch || 0) === startEpoch
  let posted = 0

  try {
    for (let round = 0; round < GROUP_CHAT_MAX_ROUNDS; round++) {
      // Deliver any replies that finished after their turn timed out —
      // every member, not just this round's responders, so long work is
      // late, never lost.
      for (const member of members) {
        if (!isCurrent()) {
          recordGroupActivity(group, { kind: 'cancelled', member: null, thread })
          return
        }

        await harvestStrandedGroupReply(group, member)
      }

      const roomLog = (($groupChats.get()[group] || {}).log || []).filter(e => groupThreadOf(e) === thread)
      // Exclude members the harvest pass just above confirmed are STILL
      // running (their stranded marker survived harvest because
      // state.inflight/running was true). Re-selecting one here would
      // prompt.submit into their live session — the gateway's default busy
      // policy redirects or hard-interrupts that turn (tui_gateway's
      // _handle_busy_submit), killing exactly the long-running work this
      // stranded/harvest mechanism exists to protect. Skip them; the next
      // harvest pass picks the reply up once it actually lands. A marker's
      // mere presence means "still stranded" (harvestStrandedGroupReply
      // deletes it once the member is confirmed done/dead) — presence, not
      // value shape, since markers are a bare number pre-thread or
      // {before, thread} post-thread.
      const strandedNow = ($groupChats.get()[group] || {}).stranded || {}
      const responders = rotateGroupSpeakers(resolveGroupResponders(roomLog, members), round)
        .filter(member => !Object.prototype.hasOwnProperty.call(strandedNow, groupMemberKey(member)))
      let spokeThisRound = 0

      for (const member of responders) {
        if (!isCurrent() || posted >= GROUP_CHAT_MAX_MESSAGES) {
          if (!isCurrent()) {
            recordGroupActivity(group, { kind: 'cancelled', member: null, thread })
          }
          return
        }

        const room = $groupChats.get()[group] || { log: [], watermarks: {} }
        const memberKey = groupMemberKey(member)
        const markKey = `${thread}::${memberKey}`
        const seen = room.watermarks[markKey] || 0
        // Delta: NEW room entries, narrowed to this thread — the member's
        // turn sees only the conversation it's part of.
        const delta = room.log.slice(seen).filter(e => groupThreadOf(e) === thread)

        if (!delta.length) {
          continue
        }

        const prompt = buildGroupChatTurnPrompt({
          groupName: group,
          members,
          viewer: member,
          deltaLines: delta.slice(-GROUP_CHAT_HISTORY_LIMIT).map(e => formatGroupChatLine(e, member.name))
        })

        // Images riding this delta (user attachments — member entries don't
        // carry images today, but flatMap keeps this future-proof) get staged
        // into the member's session so the model sees the pixels, not just
        // the transcript's [attached image: …] marker.
        const deltaImages = delta.flatMap(e => (Array.isArray(e.images) ? e.images : []))

        // Surface WHO is on turn (runtime-only, like running/epoch) so the
        // room shows "Radar is thinking…" instead of a generic working line —
        // long model turns otherwise read as the room being stuck.
        updateGroupChat(group, r => {
          r.turn = member.name
          return r
        })

        let reply = null

        try {
          reply = await runGroupChatMemberTurn(group, member, prompt, thread, deltaImages)
        } catch {
          recordGroupActivity(group, { kind: 'failed', member: member.name, thread })
          reply = null // a failed turn is a pass, never a room error
        }

        // The member has now seen everything up to the pre-reply log length.
        updateGroupChat(group, r => {
          r.watermarks[markKey] = r.log.length
          return r
        })

        if (reply !== null && !isGroupPassText(reply)) {
          appendGroupChatEntry(
            group,
            { kind: 'member', name: member.name, ...(member.remoteSource ? { source: member.connectionLabel || member.connectionId } : {}) },
            reply,
            thread
          )
          // Its own message counts as seen too.
          updateGroupChat(group, r => {
            r.watermarks[markKey] = r.log.length
            return r
          })
          posted += 1
          spokeThisRound += 1
        }
      }

      if (spokeThisRound === 0) {
        return // everyone passed — the conversation settled
      }
    }
  } finally {
    if (isCurrent()) {
      recordGroupActivity(group, { kind: 'settled', member: null, thread })
      updateGroupChat(group, r => {
        r.running = false
        r.turn = null
        return r
      })
    }
  }
}

/** User send into a group room. `thread` continues that thread; omitted/null
 *  mints a NEW one — the composer passes groupComposerThread(), so a message
 *  after a lull starts a new block of the conversation.
 *  Appends, bumps the room epoch (supersedes any running loop at its next
 *  member boundary), and starts the turn drive for the target thread.
 *  Returns the thread id the message landed in. */
function sendToGroupChat(group, members, text, thread, images) {
  const trimmed = String(text || '').trim()
  const attached = Array.isArray(images) ? images.filter(img => img && img.data) : []

  if ((!trimmed && !attached.length) || !members.length) {
    return null
  }

  const target = thread || mintGroupThreadId()

  $groupNeedsYou.set({ ...$groupNeedsYou.get(), [group]: false })
  appendGroupChatEntry(group, { kind: 'user', name: 'You' }, trimmed, target, attached)

  const wasRunning = ($groupChats.get()[group] || {}).running === true

  updateGroupChat(group, room => {
    room.epoch = (room.epoch || 0) + 1
    room.running = true
    return room
  })

  recordGroupActivity(group, { kind: 'queued', member: 'You', thread: target })

  if (!wasRunning) {
    void runGroupChatRounds(group, members, target).catch(() => {
      updateGroupChat(group, r => {
        r.running = false
        return r
      })
    })
  } else {
    // A loop is live; it bails at its next boundary. Chain the fresh loop
    // after a short settle so exactly one drive owns the room.
    setTimeout(() => {
      void runGroupChatRounds(group, members, target).catch(() => {
        updateGroupChat(group, r => {
          r.running = false
          return r
        })
      })
    }, 250)
  }

  return target
}

/** Share one in-flight async operation across concurrent callers. Failures
 * clear the slot so a later attempt can retry. */
function singleFlight(ref, start) {
  if (ref.current) {
    return ref.current
  }

  let flight
  try {
    flight = Promise.resolve(start())
  } catch (err) {
    flight = Promise.reject(err)
  }
  ref.current = flight
  flight.catch(() => {
    if (ref.current === flight) {
      ref.current = null
    }
  })
  return flight
}

/** The agent-to-agent messaging protocol, reusable so a CUSTOM SOUL keeps
 *  the handoff protocol too — a custom SOUL used to silently drop it,
 *  breaking @mentions for customized bots (@wesleysimplicio, #16). */
function messagingProtocolSection(name, roster) {
  const teammates = (roster || []).filter(b => b.name !== name)
  const handle = botHandle(name)

  return [
    '## Messaging other agents',
    '',
    'You work alongside other named agents. Every agent (including you) has',
    'ONE canonical conversation titled "Bot Chat" — created with the agent,',
    'so it always exists. Agent-to-agent messages are delivered straight',
    'into it, like a DM. To message a teammate, run:',
    '',
    '```',
    'work4you -p <agent-name> chat --in ~ -c "Bot Chat" --create-if-missing -Q -q "Message from \uD83E\uDD16 ' + handle + ' (@' + handle + '): your message"',
    '',
    'Run the send with background=true and notify_on_complete=true on the',
    'terminal tool, then finish your turn — the reply arrives later as a',
    'background process notification. Never block waiting for it.',
    '```',
    '',
    '(`--in ~ -c "Bot Chat" --create-if-missing` resumes their canonical',
    'conversation in the home workspace, creating it if the target has no',
    '"Bot Chat" yet. `-Q` keeps output clean. Always open with the',
    '"Message from \uD83E\uDD16 ' + handle + ' (@' + handle + '):" prefix so they know',
    'who is talking (the @handle lets the app show your avatar to them).',
    'Their reply prints to stdout — relay the relevant part back to the',
    'user, and say which agent it came from.)',
    '',
    'If a message in YOUR chat starts with "Message from \uD83E\uDD16 <name>", it is',
    'a teammate messaging you, not the user. Answer it directly — your reply',
    'reaches them via their own delivery — and use the same command if you',
    'need to start a conversation yourself.',
    '',
    'When the user writes @<agent-name> or says "ask <name> to ..." /',
    '"tell <name> ...", that is a handoff: message that agent, wait for the',
    'reply, and report back.',
    '',
    'The roster grows over time — run `work4you profile list` for the LIVE',
    'teammate list before a handoff. Teammates when you were created:',
    ...(teammates.length
      ? teammates.map(b => `- \`${b.name}\`${b.description ? ` — ${b.description}` : ''}`)
      : ['- (none yet)'])
  ].join('\n')
}

/** True when SOUL.md already carries the Bot Mode handoff section.
 *  #16 appends this at create-time; pre-existing profiles (especially
 *  `default`) never went through composeSoul and silently lack it. */
function hasMessagingProtocol(soul) {
  return /(^|\n)## Messaging other agents(\s|$)/.test(soul || '')
}

/** Idempotent: append the protocol once, never duplicate a custom SOUL
 *  that already has it (clone-from-default after a backfill, Edit save).
 *  No-op when the backend injects the protocol into the system prompt
 *  itself (bot_mode_protocol) — SOUL.md stays the user's identity text. */
function ensureMessagingProtocol(soul, name, roster) {
  const text = (soul || '').trim()
  if (serverInjectsProtocol || hasMessagingProtocol(text)) return text
  const section = messagingProtocolSection(name, roster)
  return text ? text + '\n\n' + section : section
}

const soulProtocolChecked = new Set()
const soulProtocolInflight = new Set()

/** One-shot per profile per session: if an existing SOUL has no protocol,
 *  append it. This is the install-time fix for default / pre-Bot-Mode
 *  personas that #16 never touched. Never overwrites identity text. */
function backfillMessagingProtocol(roster) {
  // Newer backends teach the protocol via the system prompt — never touch
  // user SOUL files when the server already covers every session.
  if (serverInjectsProtocol) {
    return
  }

  for (const bot of roster || []) {
    const name = bot && bot.name
    if (!name || soulProtocolChecked.has(name) || soulProtocolInflight.has(name)) {
      continue
    }

    soulProtocolInflight.add(name)
    host
      .request('profiles.describe', { name })
      .then(res => {
        const soul = (res && res.soul) || ''
        if (hasMessagingProtocol(soul)) {
          soulProtocolChecked.add(name)
          return null
        }
        return host
          .request('profiles.configure', { name, soul: ensureMessagingProtocol(soul, name, roster) })
          .then(() => {
            soulProtocolChecked.add(name)
          })
      })
      .catch(() => {
        // Older gateway or a one-off describe/configure miss — do not hammer.
        soulProtocolChecked.add(name)
      })
      .finally(() => {
        soulProtocolInflight.delete(name)
      })
  }
}

/** SOUL.md for a new bot: identity (or the user's custom SOUL) + the
 *  messaging protocol — which ships UNLESS the backend injects it into the
 *  system prompt itself (bot_mode_protocol capability). */
function composeSoul({ name, title, description, roster, customSoul }) {
  if (customSoul && customSoul.trim()) {
    return ensureMessagingProtocol(customSoul, name, roster)
  }

  const lines = [
    `# ${displayName({ name, title })}`,
    '',
    title ? `**Role:** ${title}` : null,
    description ? `**Mission:** ${description}` : null,
    '',
    `You are ${displayName({ name, title })}, a persistent named agent (profile \`${name}\`) on this machine.`,
    'You keep your own memory, skills, and conversation history across sessions.'
  ]

  const identity = lines.filter(line => line !== null).join('\n')

  return serverInjectsProtocol ? identity : identity + '\n\n' + messagingProtocolSection(name, roster)
}

// ── human-readable row helpers ───────────────────────────────────────────────

/** Bot-to-bot delivery prefix (see messagingProtocolSection): either the
 *  current "Message from 🤖 name (@handle):" form or the older
 *  "[Message from agent 'name']" shape. Captures the sender's handle. */
const A2A_RE = /^Message from (?:agent '([^']+)'|🤖\s*([^\s(@]+))/i

/** Strip the delivery prefix so a DM preview reads like a DM, not a log line. */
const A2A_PREFIX_RE = /^Message from (?:agent '[^']+'|🤖[^:]+):\s*/i

/** Classify a roster preview: `{ fromBot: handle|null }`. A preview that
 *  starts with the delivery prefix is a bot-to-bot message — the receiving
 *  bot's row should show WHO sent it, not present it as the human's chat. */
function previewKind(preview) {
  const text = (preview || '').trim()
  if (!text) {
    return { fromBot: null }
  }
  const match = text.match(A2A_RE)
  if (match) {
    // The captured name is whatever the delivery prefix carried — a raw
    // profile name. Map it the way every other surface does so the primary
    // profile reads @work4you, never @default (#89484).
    const sender = (match[1] || match[2] || '').trim().toLowerCase()
    return { fromBot: sender ? botHandle(sender) : null }
  }
  return { fromBot: null }
}

/** Session titles the gateway auto-assigns that carry no information. */
const GENERIC_TITLES = new Set(['', 'bot chat', 'new chat', 'new conversation', 'conversation', 'chat', 'untitled'])

function isGenericTitle(title) {
  return GENERIC_TITLES.has((title || '').trim().toLowerCase())
}

/** Title for the session chip: the real session title when it means
 *  something, otherwise a short label generated from the newest message
 *  (delivery prefixes stripped) so "Bot Chat" rows still say what the
 *  conversation is actually about. */
function generatedSessionTitle(session, preview, t = tr) {
  const raw = (session?.title || '').trim()
  if (raw && !isGenericTitle(raw)) {
    return raw
  }
  const cleaned = (preview || '').trim().replace(A2A_PREFIX_RE, '').trim()
  if (!cleaned) {
    return raw || t('sessions.conversation')
  }
  const words = cleaned.split(/\s+/).slice(0, 5).join(' ').replace(/[,;:.]+$/, '')
  if (!words) {
    return raw || t('sessions.conversation')
  }
  return words.length > 34 ? `${words.slice(0, 33)}…` : words
}

/** Roster liveness window: a bot whose last message landed within this many
 *  seconds is treated as "active now" (pulsing dot in its row). */
const ACTIVE_WINDOW_S = 90

/** The session whose activity best represents this bot — the FRESHER of the
 *  pinned canonical Bot Chat (preferred_session) and the profile's newest
 *  visible conversation (last_session).
 *
 *  Canonical Bot Chats are hidden from the session list by design, so
 *  last_session alone never sees them: a bot you talk to all day through its
 *  Bot Chat reads "6d ago" because its newest VISIBLE session is a week old.
 *  #88690 moved the preview text to preferred_session but left every activity
 *  signal (age label, pulse dot, unread watermark, recency sort) on
 *  last_session. All of them key off this helper now. Older gateways without
 *  the preferred_session resolver degrade to last_session unchanged. */
function botActivitySession(bot) {
  const preferred = bot?.preferred_session
  const last = bot?.last_session

  if (!preferred || !last) {
    return preferred || last || null
  }

  return (preferred.last_active || 0) >= (last.last_active || 0) ? preferred : last
}

/** Bots that are working right now: the profile the gateway is running a
 *  turn for (busy), plus any bot whose last message landed inside the
 *  liveness window. Pure — output follows the input roster's order, so
 *  presence never reorders or hides the normal list. */
function activeBots(roster, activeProfile, gatewayState, now = Date.now()) {
  return (roster || []).filter(bot => {
    const busyTurn = !bot.remoteSource && bot.name === activeProfile && gatewayState === 'busy'
    const last = botActivitySession(bot)?.last_active || 0
    const inWindow = Boolean(last && now / 1000 - last < ACTIVE_WINDOW_S)

    return busyTurn || inWindow
  })
}

// ── bot row ──────────────────────────────────────────────────────────────────

function BotRow({ bot, onDelete, onEdit, onGroup }) {
  const t = useBotModeT()
  const activeProfile = useValue(host.state.profile)
  const focusedProfile = useValue($focusedBotProfile)
  const activeGroup = useOpenGroupRoom()
  const meta = botRosterMeta(bot, useValue($botMeta))
  const groups = botGroups(meta)
  const last = bot.last_session
  // Highlight follows the chat on screen (focused session's owner), not the
  // gateway socket's home — a focused tab doesn't swap the socket, and on the
  // old keying the wrong bot stayed highlighted while you read another's chat.
  // A group room on screen suppresses every bot-row highlight: the group row
  // owns the selection then (#88979).
  const isActive = !activeGroup && !bot.remoteSource && bot.name === focusedProfile
  // Turn-busy is a SOCKET fact: only the gateway-home profile can be mid-turn.
  const isGatewayHome = !bot.remoteSource && bot.name === activeProfile
  const { shape, color, image } = botAppearance(bot.name, meta)
  // Keep user photos/pets. Drop the 160px SVG backfill so the math face can move.
  const photo = Boolean(image && !isBackfilledFacePng(image))
  const gatewayState = useValue(host.state.gateway)
  // Preview identity must match click identity (#88200): when the backend
  // resolved the pinned canonical chat, preview THAT session — not the
  // profile's most recent (but unrelated) activity. Activity signals
  // (age label, pulse dot) follow the same rule via botActivitySession:
  // the canonical Bot Chat is hidden from last_session, so keying age off
  // last_session alone shows "6d ago" on a bot you just messaged.
  const previewSession = bot.preferred_session || last
  const activitySession = botActivitySession(bot)
  const activeNow = Boolean(
    activitySession?.last_active && Date.now() / 1000 - activitySession.last_active < ACTIVE_WINDOW_S
  )
  // Work pose only when this bot is actually doing something: the active
  // profile while the gateway is busy, or a bot that wrote within the
  // liveness window. Not every bot whenever the gateway is busy.
  const botMood = (isGatewayHome && gatewayState === 'busy') || activeNow ? 'work' : 'idle'
  // Subscribe on every render. A source switch turns the same keyed row from
  // thin to rich; conditionally calling useValue here breaks React hook order.
  const unreadByName = useValue($botUnread)
  const unread = !bot.remoteSource && Boolean(unreadByName[bot.name])
  // WHO sent the last message (bot-to-bot DM vs human) — the full stored
  // history lives in the Sessions workspace (context menu), not inline.
  const { fromBot } = previewKind(previewSession?.preview)
  // DM previews read like DMs: strip the delivery prefix, keep the message.
  const displayPreview = stripPreviewMarkdown(
    fromBot
      ? (previewSession?.preview || '').replace(A2A_PREFIX_RE, '').trim() || '…'
      : previewSession?.preview || bot.description || t('roster.noConversations')
  )

  const warm = () => {
    // Multi-source row: pre-dial the agent's OWN source (feature-detected).
    if (bot.sourceScoped && typeof host.warmAgent === 'function') {
      try {
        host.warmAgent(bot.connectionId, bot.name)
      } catch {
        /* warm is best-effort */
      }

      return
    }

    if (typeof host.warmProfile !== 'function') {
      return
    }

    try {
      host.warmProfile(bot.name)
    } catch {
      /* warm is best-effort */
    }
  }

  const open = async () => {
    const generation = ++botOpenGeneration
    haptic('tap')
    $selectedBot.set(bot.name)

    if (bot.remoteSource) {
      const handle = botHandle(bot.name, bot)
      host.notify?.({
        kind: 'info',
        title: displayName(bot),
        message: t('remote.stayInChat', handle)
      })
      return
    }

    let pinnedChat = meta?.chat

    if (!bot.remoteSource && $botUnread.get()[bot.name]) {
      const next = { ...$botUnread.get() }
      delete next[bot.name]
      $botUnread.set(next)
    }

    // Activate the owner first so every canonical-chat RPC lands on the
    // backend that owns this bot's state database.
    try {
      pinnedChat = await prepareBotSource(bot, pinnedChat)
    } catch (error) {
      host.notifyError?.(error, t('remote.reachFailed', bot.connectionLabel || t('remote.remoteSource')))

      return
    }

    if (generation !== botOpenGeneration) {
      return
    }

    try {
      const id = await openBotCanonicalChat(bot.name, pinnedChat, previewSession)

      if (generation === botOpenGeneration && id) {
        return
      }
    } catch (error) {
      if (generation === botOpenGeneration) {
        host.notifyError?.(error, t('roster.openFailed', displayName(bot, meta)))
      }

      return
    }

    if (generation !== botOpenGeneration) {
      return
    }

    if (typeof host.newChat === 'function') {
      // Older gateway without profile-scoped session.create — plain draft.
      host.newChat(bot.name)
    } else {
      host.navigate('/')
    }
  }

  const row = jsxs('button', {
    type: 'button',
    onPointerEnter: warm,
    onClick: open,
    className: cn(
      'flex w-full min-w-0 max-w-full items-center gap-2.5 overflow-hidden rounded-md px-2 py-2 text-left transition-colors',
      'hover:bg-(--chrome-action-hover)',
      isActive && 'bg-(--chrome-action-hover)',
      // Hidden bots only render while the header eye toggle is on — dimmed,
      // so the temporary reveal reads as a different state from the roster.
      meta?.hidden && 'opacity-60'
    ),
    children: [
      jsx('div', {
        className: 'shrink-0',
        children: jsx(BotFace, { shape, color, image: photo ? image : null, size: 34, name: bot.name, mood: botMood })
      }),
      jsxs('div', {
        className: 'min-w-0 flex-1',
        children: [
          jsxs('div', {
            className: 'flex items-baseline justify-between gap-2',
            children: [
              jsxs('div', {
                className: 'flex min-w-0 items-baseline gap-1.5 truncate',
                children: [
                  meta?.pinned
                    ? jsx('span', {
                        className: 'shrink-0 text-[0.6875rem] text-(--ui-text-quaternary)',
                        title: t('roster.pinned'),
                        children: '📌'
                      })
                    : null,
                  meta?.hidden
                    ? jsx(Codicon, {
                        name: 'eye-closed',
                        className: 'shrink-0 text-[0.6875rem] text-(--ui-text-quaternary)',
                        title: t('roster.hiddenFromRoster')
                      })
                    : null,
                  jsx('span', {
                    className: cn(
                      'truncate text-[0.8125rem] font-medium',
                      bot.remoteSource && 'max-w-[42%] shrink-0'
                    ),
                    children: displayName(bot, meta)
                  }),
                  showsHandle(bot.name, meta, bot)
                    ? jsx('span', {
                        className: 'min-w-0 truncate font-mono text-[0.6875rem] text-(--ui-text-quaternary)',
                        children: `@${botHandle(bot.name, bot)}`
                      })
                    : null,
                  bot.remoteSource
                    ? jsx('span', {
                        className:
                          'max-w-[28%] shrink-0 truncate rounded bg-(--chrome-action-hover) px-1 font-mono text-[0.625rem] text-(--ui-text-tertiary)',
                        title: t('roster.livesOn', bot.connectionLabel),
                        children: bot.connectionLabel
                      })
                    : null
                ]
              }),
              unread
                ? jsx('span', {
                    className: 'size-2 shrink-0 rounded-full bg-(--ui-accent,#4f9cf9)',
                    'aria-label': t('roster.unread')
                  })
                : null,
              activeNow
                ? jsx('span', {
                    className: 'work4you-bots-pulse size-1.5 shrink-0 rounded-full bg-(--ui-accent,#4f9cf9)',
                    title: t('roster.activeRecently')
                  })
                : null,
              activitySession
                ? jsx('span', {
                    className: 'shrink-0 text-[0.6875rem] text-(--ui-text-quaternary)',
                    children: relativeTime(activitySession.last_active * 1000)
                  })
                : null
            ]
          }),
          jsxs('div', {
            className: 'flex min-w-0 items-center gap-1',
            children: [
              jsx('div', {
                className: fromBot
                  ? 'min-w-0 truncate text-xs italic text-(--ui-accent,#4f9cf9)'
                  : 'min-w-0 truncate text-xs text-(--ui-text-tertiary)',
                children: displayPreview
              }),
              fromBot
                ? jsxs('span', {
                    className:
                      'flex shrink-0 items-center gap-1 rounded-full bg-(--chrome-action-hover) px-1.5 py-px text-[0.625rem] font-medium text-(--ui-accent,#4f9cf9)',
                    title: t('roster.lastFromBot', fromBot),
                    children: ['🤖', `@${fromBot}`]
                  })
                : null
            ]
          })
        ]
      })
    ]
  })

  // Thin rows from another source are navigation targets only. Their profile
  // metadata is not loaded yet, so edit/delete/pin/group actions would mutate
  // whichever backend happens to be active. A normal click activates the
  // owner; the refreshed rich row then exposes the full context menu.
  if (bot.remoteSource) {
    return row
  }

  return jsxs(ContextMenu, {
    children: [
      jsx(ContextMenuTrigger, { asChild: true, children: row }),
      jsxs(ContextMenuContent, {
        children: [
          jsx(ContextMenuItem, {
            onSelect: () => {
              const pinned = Boolean($botMeta.get()[bot.name]?.pinned)
              saveBotMeta(bot.name, { pinned: !pinned })
              host.notify({
                kind: 'info',
                message: pinned
                  ? t('roster.unpinned', displayName(bot, meta))
                  : t('roster.pinnedToTop', displayName(bot, meta))
              })
            },
            children: meta?.pinned ? t('roster.menu.unpin') : t('roster.menu.pin')
          }),
          jsx(ContextMenuItem, {
            onSelect: () => {
              const hidden = Boolean($botMeta.get()[bot.name]?.hidden)
              // `hidden: false` (not null) so unhide round-trips through the
              // server ui_meta merge the same way the local merge sees it.
              saveBotMeta(bot.name, { hidden: !hidden })

              if (!hidden) {
                fallbackSelectionAfterHide(bot.name)
              }

              host.notify({
                kind: 'info',
                message: hidden
                  ? t('roster.backInRoster', displayName(bot, meta))
                  : t('roster.hiddenNotice', displayName(bot, meta))
              })
            },
            children: meta?.hidden ? t('roster.menu.unhide') : t('roster.menu.hide')
          }),
          jsx(ContextMenuSeparator, {}),
          jsx(ContextMenuItem, {
            onSelect: () => openBotSessionsWorkspace(bot),
            children: t('roster.menu.sessions')
          }),
          jsx(ContextMenuItem, { onSelect: () => onEdit(bot), children: t('roster.menu.editProfile') }),
          !bot.remoteSource
            ? jsx(ContextMenuItem, {
                onSelect: () => onGroup(bot),
                children: groups.length ? t('roster.menu.groups', groups.join(', ')) : t('roster.menu.manageGroups')
              })
            : null,
          jsx(ContextMenuItem, {
            onSelect: () => {
              host.notify({ kind: 'info', message: t('roster.duplicating', displayName(bot, meta)) })
              duplicateBot(bot, $lastRoster.get().filter(candidate => !candidate.remoteSource))
                .then(name => {
                  queryClient.invalidateQueries({ queryKey: ROSTER_KEY })
                  host.notify({ kind: 'success', message: t('roster.duplicated', name, bot.name) })
                })
                .catch(err => host.notifyError(err, t('roster.duplicateFailed')))
            },
            children: t('roster.menu.duplicate')
          }),
          jsx(ContextMenuSeparator, {}),
          jsx(ContextMenuItem, {
            onSelect: () => {
              $selectedBot.set(bot.name)

              if (typeof host.newChat === 'function') {
                host.newChat(bot.name)
              }
            },
            children: t('roster.menu.newChat')
          }),
          bot.is_default ? null : jsx(ContextMenuSeparator, {}),
          bot.is_default
            ? null
            : jsx(ContextMenuItem, {
                onSelect: () => onDelete(bot),
                variant: 'destructive',
                children: t('roster.menu.delete')
              })
        ]
      })
    ]
  })
}

// ── model picker (provider/model dropdowns via model.options) ───────────────
// Same flags as a normal Settings → Model / composer open: only providers the
// user connected. include_unconfigured would list Fireworks / OpenRouter /
// etc. with no key, which New Agent cannot set up. No `refresh`: it busts
// every provider's model cache and re-fetches the live catalogs, which the
// app keeps for the explicit "refresh models" action.
const MODEL_OPTIONS_PARAMS = { explicit_only: true }

// Provider-select sentinel for "Inherit (launch profile)".
const MODEL_PICKER_INHERIT = '__default__'

// The Portal row reads as the product name, not "Work4You Portal (work4you)".
const PORTAL_PROVIDER_SLUG = 'work4you'
const PORTAL_PROVIDER_LABEL = 'Work4You'

function providerOptionLabel(provider) {
  if (provider.slug === PORTAL_PROVIDER_SLUG) {
    return PORTAL_PROVIDER_LABEL
  }

  return provider.name ? `${provider.name} (${provider.slug})` : provider.slug
}

function providerModelIds(provider) {
  return (provider?.models || []).map(m => (typeof m === 'string' ? m : m.id || m.name || ''))
}

/** Models this account cannot use: paid models on a Free Portal plan. */
function lockedModelIds(provider) {
  return new Set(provider?.unavailable_models || [])
}

/** The model to land on for `provider`: the current one when the provider
 *  lists it and the account can use it, else the first usable one. */
function modelForProvider(provider, currentModel) {
  const ids = providerModelIds(provider)
  const locked = lockedModelIds(provider)

  if (currentModel && ids.includes(currentModel) && !locked.has(currentModel)) {
    return currentModel
  }

  return ids.find(id => id && !locked.has(id)) || ''
}

/** Free-text mode only when the user chose it (`freeTextChoice` true/false),
 *  or, before any choice (null), when the loaded inventory does not list the
 *  provider. Read from the inventory on every render: freezing it on the
 *  first render, while model.options is still loading and the list is empty,
 *  made every pinned provider look unknown and stuck New Agent in free text. */
function modelPickerUsesFreeText(freeTextChoice, provider, providers) {
  if (freeTextChoice !== null) {
    return freeTextChoice
  }

  if (!provider || provider === MODEL_PICKER_INHERIT) {
    return false
  }

  return !providers.some(p => p.slug === provider)
}

function useModelOptions() {
  return useQuery({
    queryKey: [ID, 'model-options'],
    queryFn: () => host.request('model.options', MODEL_OPTIONS_PARAMS),
    staleTime: 120000,
    retry: false
  })
}

/**
 * Provider + model dropdowns from the gateway's configured inventory — the
 * same data Settings and the composer show. `value = {provider, model}`;
 * onChange receives the merged patch.
 */
function ModelPicker({ value, onChange, placeholderModel }) {
  const t = useBotModeT()
  const { data, isLoading, error } = useModelOptions()

  // Hooks are ALWAYS declared up front, before any conditional return.
  // Declaring them after a return trips React error #310.
  const NONE = MODEL_PICKER_INHERIT
  const CUSTOM = '__custom__'
  const providers = (data?.providers || []).filter(p => p && p.slug)
  // null until the user picks a mode — see modelPickerUsesFreeText.
  const [freeTextChoice, setFreeTextChoice] = useState(null)
  const useFreeText = modelPickerUsesFreeText(freeTextChoice, value.provider, providers)

  if (isLoading) {
    return jsx('div', {
      className: 'flex justify-center py-2',
      children: jsx(GlyphSpinner, { spinner: 'breathe', className: 'text-(--ui-text-tertiary)' })
    })
  }

  if (error || !providers.length) {
    // Fallback: free text (older gateway or empty inventory).
    return jsxs('div', {
      style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' },
      children: [
        labeled(
          t('model.provider'),
          jsx(Input, {
            placeholder: 'omnirouter / 9router / work4you \u2026',
            value: value.provider,
            onChange: event => onChange({ provider: event.target.value })
          })
        ),
        labeled(
          t('model.model'),
          jsx(Input, {
            placeholder: 'antigravity/gemini-3.6-flash-high',
            value: value.model,
            onChange: event => onChange({ model: event.target.value })
          })
        )
      ]
    })
  }

  if (useFreeText) {
    return jsxs('div', {
      style: { display: 'flex', flexDirection: 'column', gap: '8px' },
      children: [
        jsxs('div', {
          style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' },
          children: [
            labeled(
              t('model.providerCustom'),
              jsx(Input, {
                placeholder: t('model.providerExample'),
                value: value.provider,
                onChange: event => onChange({ provider: event.target.value })
              })
            ),
            labeled(
              t('model.modelCustom'),
              jsx(Input, {
                placeholder: t('model.modelExample'),
                value: value.model,
                onChange: event => onChange({ model: event.target.value })
              })
            )
          ]
        }),
        jsx(Button, {
          variant: 'ghost',
          size: 'sm',
          className: 'w-fit self-start text-[length:var(--conversation-text-font-size)] text-(--ui-text-secondary)',
          onClick: () => setFreeTextChoice(false),
          children: t('model.backToDropdowns')
        })
      ]
    })
  }

  const activeProvider = providers.find(p => p.slug === value.provider) || null
  const models = activeProvider ? providerModelIds(activeProvider) : []
  const locked = lockedModelIds(activeProvider)

  return jsxs('div', {
    style: { display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '10px' },
    children: [
      labeled(
        t('model.provider'),
        jsxs(Select, {
          value: value.provider || NONE,
          onValueChange: v => {
            if (v === NONE) {
              onChange({ provider: '', model: '' })
            } else if (v === CUSTOM) {
              setFreeTextChoice(true)
            } else {
              const prov = providers.find(p => p.slug === v)
              onChange({ provider: v, model: modelForProvider(prov, value.model) })
            }
          },
          children: [
            jsx(SelectTrigger, { children: jsx(SelectValue, {}) }),
            jsxs(SelectContent, {
              children: [
                jsx(SelectItem, { value: NONE, children: t('model.inherit') }),
                ...providers.map(p =>
                  jsx(
                    SelectItem,
                    { value: p.slug, children: providerOptionLabel(p) },
                    p.slug
                  )
                ),
                jsx(SelectItem, { value: CUSTOM, children: t('model.enterManually') })
              ]
            })
          ]
        })
      ),
      labeled(
        t('model.model'),
        activeProvider && models.length > 0
          ? jsxs(Select, {
              value: value.model || modelForProvider(activeProvider, ''),
              onValueChange: v => onChange({ model: v }),
              children: [
                jsx(SelectTrigger, { children: jsx(SelectValue, {}) }),
                jsx(SelectContent, {
                  children: models.map(m =>
                    // Same lock the composer picker shows: listed, not selectable.
                    locked.has(m)
                      ? jsx(
                          SelectItem,
                          {
                            value: m,
                            disabled: true,
                            children: jsxs('span', {
                              className: 'flex items-center gap-1.5',
                              children: [
                                displayModelName(m),
                                jsx(Codicon, {
                                  className: 'shrink-0 opacity-80',
                                  name: 'lock',
                                  size: '0.75rem',
                                  title: t('model.proNeedsSubscription')
                                })
                              ]
                            })
                          },
                          m
                        )
                      : jsx(SelectItem, { value: m, children: displayModelName(m) }, m)
                  )
                })
              ]
            })
          : jsx(Input, {
              placeholder:
                (placeholderModel === undefined ? t('model.gatewayDefault') : placeholderModel) ||
                t('model.namePlaceholder'),
              value: value.model,
              onChange: event => onChange({ model: event.target.value })
            })
      )
    ]
  })
}

// ── advanced profile config (skills / toolsets / model / SOUL) ──────────────
//
// Shared by Edit Profile and New Agent (edit mode only for skills/toolsets —
// a not-yet-created profile has nothing installed to toggle). Backed by
// profiles.describe / profiles.configure; feature-detects older gateways.

function CheckList({ items, onToggle, columns = 2 }) {
  return jsx('div', {
    style: {
      display: 'grid',
      gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      gap: '2px 12px'
    },
    children: items.map(item =>
      jsxs(
        'label',
        {
          className: 'flex min-w-0 cursor-pointer items-center gap-1.5 py-0.5 text-xs text-(--ui-text-secondary)',
          title: item.description || item.name,
          children: [
            jsx(Checkbox, {
              checked: item.enabled,
              onCheckedChange: value => onToggle(item.name, Boolean(value))
            }),
            jsx('span', { className: 'truncate', children: item.name }),
            item.tool_count
              ? jsx('span', {
                  className: 'shrink-0 text-[0.6rem] text-(--ui-text-quaternary)',
                  children: `${item.tool_count}`
                })
              : null
          ]
        },
        item.name
      )
    )
  })
}

function AdvancedProfileConfig({ bot, state, setState }) {
  const t = useBotModeT()
  const [loaded, setLoaded] = useState(false)
  const [unsupported, setUnsupported] = useState(false)
  const [skillFilter, setSkillFilter] = useState('')

  if (!loaded) {
    setLoaded(true)
    Promise.all([
      host.request('profiles.describe', { name: bot }),
      host.request('mcp.catalog', { profile: bot }).catch(() => null)
    ])
      .then(([res, cat]) => {
        const configured = res.mcp_servers || []
        const have = new Set(configured.map(m => m.name))
        const catalog = ((cat && cat.servers) || []).filter(s => !have.has(s.name))
        setState(prev => ({
          ...prev,
          provider: res.model?.provider || '',
          model: res.model?.default || '',
          soul: res.soul || '',
          skills: res.skills || [],
          toolsets: res.toolsets || [],
          mcp: [
            ...configured.map(m => ({ ...m, enabled: m.enabled !== false })),
            ...catalog.map(s => ({
              name: s.name,
              enabled: false,
              fromCatalog: true,
              installed: s.installed,
              auth: s.auth,
              requires: s.requires || [],
              description: s.description || ''
            }))
          ],
          loaded: true
        }))
      })
      .catch(() => setUnsupported(true))
  }

  if (unsupported) {
    return jsx('div', {
      className: 'px-2 py-3 text-center text-xs text-(--ui-text-tertiary)',
      children: t('config.needsNewerGateway')
    })
  }

  if (!state.loaded) {
    return jsx('div', {
      className: 'flex justify-center py-4',
      children: jsx(GlyphSpinner, { spinner: 'breathe', className: 'text-(--ui-text-tertiary)' })
    })
  }

  const visibleSkills = skillFilter.trim()
    ? state.skills.filter(s => s.name.toLowerCase().includes(skillFilter.trim().toLowerCase()))
    : state.skills

  const toggleSkill = (name, enabled) =>
    setState(prev => ({
      ...prev,
      dirtySkills: true,
      skills: prev.skills.map(s => (s.name === name ? { ...s, enabled } : s))
    }))

  const toggleToolset = (name, enabled) =>
    setState(prev => ({
      ...prev,
      dirtyToolsets: true,
      toolsets: prev.toolsets.map(t => (t.name === name ? { ...t, enabled } : t))
    }))

  const toggleMcp = (name, enabled) =>
    setState(prev => ({
      ...prev,
      dirtyMcp: true,
      mcp: (prev.mcp || []).map(m => (m.name === name ? { ...m, enabled } : m))
    }))

  const enabledSkills = state.skills.filter(s => s.enabled).length
  const enabledToolsets = state.toolsets.filter(t => t.enabled).length
  const mcpList = state.mcp || []
  const enabledMcp = mcpList.filter(m => m.enabled).length

  // Newer desktop builds export the WHOLE core Capabilities surface
  // (work4you#87317): Skills (installed list + one-click hub installs +
  // full-skill detail), Tools (per-toolset config), and MCP — pinned to this
  // bot via fixedProfile, tab state kept out of the page router via embedded.
  // Render THAT instead of the checkbox stand-ins; writes go straight to the
  // bot's backend, so the dirty-section staging below only carries
  // model + SOUL on these builds. Older builds keep the full checklist UI.
  if (SkillsView) {
    return jsxs('div', {
      className: 'grid gap-4',
      children: [
        jsx(ModelPicker, {
          value: { provider: state.provider, model: state.model },
          onChange: patch => setState(prev => ({ ...prev, dirtyModel: true, ...patch }))
        }),
        labeled(
          t('config.capabilities'),
          jsx('div', {
            className: 'min-w-0 overflow-hidden rounded-(--ui-stage-radius) border border-(--ui-stroke-tertiary)',
            style: { height: 460, minHeight: 300, resize: 'vertical', overflow: 'auto' },
            children: jsx(SkillsView, { embedded: true, fixedProfile: bot })
          })
        ),
        labeled(
          t('config.soul'),
          jsx(Textarea, {
            className: 'min-h-28 font-mono text-xs leading-5',
            value: state.soul,
            onChange: event => setState(prev => ({ ...prev, dirtySoul: true, soul: event.target.value }))
          })
        )
      ]
    })
  }

  return jsxs('div', {
    className: 'grid gap-4',
    children: [
      jsx(ModelPicker, {
        value: { provider: state.provider, model: state.model },
        onChange: patch => setState(prev => ({ ...prev, dirtyModel: true, ...patch }))
      }),
      labeled(
        t('config.skills', enabledSkills, state.skills.length),
        jsxs('div', {
          className: 'grid gap-1.5 rounded-md border border-(--ui-stroke-secondary) p-2',
          children: [
            jsx(Input, {
              className: 'h-7 text-xs',
              placeholder: t('config.filterSkills'),
              value: skillFilter,
              onChange: event => setSkillFilter(event.target.value)
            }),
            jsx(ScrollArea, {
              className: 'work4you-scroll-cap',
              style: { maxHeight: 180 },
              children: jsx(CheckList, { items: visibleSkills, onToggle: toggleSkill, columns: 2 })
            }),
            jsx(HubSkillsSection, {
              forProfile: bot,
              onInstalled: name =>
                setState(prev =>
                  prev.skills.some(s => s.name === name)
                    ? prev
                    : { ...prev, skills: [...prev.skills, { name, enabled: true }] }
                )
            })
          ]
        })
      ),
      labeled(
        t('config.toolsets', enabledToolsets, state.toolsets.length),
        jsx('div', {
          className: 'rounded-md border border-(--ui-stroke-secondary) p-2',
          children: jsx(ScrollArea, {
            className: 'work4you-scroll-cap',
            style: { maxHeight: 320 },
            children: jsx('div', {
              className: 'grid gap-1.5',
              children: state.toolsets.map(tset =>
                jsxs(
                  'div',
                  {
                    className: 'rounded-md border border-(--ui-stroke-secondary) p-2',
                    children: [
                      jsxs('label', {
                        className: 'flex items-center gap-2 text-xs font-medium text-(--ui-text-secondary)',
                        children: [
                          jsx(Checkbox, {
                            checked: !!tset.enabled,
                            onCheckedChange: value => toggleToolset(tset.name, Boolean(value))
                          }),
                          jsx('span', { children: tset.name })
                        ]
                      }),
                      // The REAL per-toolset config (env vars / API keys / model
                      // picker / post-setup), scoped to THIS bot's profile, when
                      // the desktop build exposes it. Older builds: just the toggle.
                      ToolsetConfigPanel
                        ? jsx('div', {
                            className: 'mt-1.5 border-t border-(--ui-stroke-secondary) pt-1.5',
                            children: jsx(ToolsetConfigPanel, { toolset: tset.name, profile: bot })
                          })
                        : null
                    ]
                  },
                  tset.name
                )
              )
            })
          })
        })
      ),
      labeled(
        t('config.mcpServers'),
        jsx('div', {
          className: 'overflow-hidden rounded-md border border-(--ui-stroke-secondary)',
          // The REAL MCP tab core Settings renders — per-server enable + OAuth
          // sign-in + API-key setup + live probes — scoped to this bot's profile.
          // Feature-detected: older desktop builds without the SDK export fall
          // back to the plugin's own checkbox list + inline setup buttons.
          children: McpTab && typeof host.getGateway === 'function'
            ? jsx('div', {
                style: { minHeight: 220, maxHeight: 360 },
                children: jsx(McpTab, { gateway: host.getGateway(), profile: bot })
              })
            : mcpList.length === 0
              ? jsx('div', {
                  className: 'px-1 py-2 text-center text-xs text-(--ui-text-tertiary)',
                  children: t('config.noMcp')
                })
              : jsx(ScrollArea, {
                  className: 'work4you-scroll-cap',
                  style: { maxHeight: 180 },
                  children: jsx('div', {
                    className: 'grid gap-1 p-2',
                    children: mcpList.map(m => {
                      const needsSetup = m.fromCatalog && !m.installed && ((m.requires || []).length > 0 || (m.auth || '').toLowerCase() === 'oauth')
                      return jsxs(
                        'label',
                        {
                          className: 'flex items-start gap-2 text-xs text-(--ui-text-secondary)',
                          children: [
                            jsx(Checkbox, {
                              checked: !!m.enabled,
                              disabled: needsSetup,
                              onCheckedChange: value => toggleMcp(m.name, Boolean(value))
                            }),
                            jsxs('span', {
                              className: 'min-w-0',
                              children: [
                                jsx('span', { children: m.name }),
                                m.fromCatalog && !needsSetup
                                  ? jsx('span', {
                                      className: 'ml-1.5 text-[0.65rem] text-(--ui-text-quaternary)',
                                      children: m.installed ? t('config.catalogInstalled') : t('config.catalog')
                                    })
                                  : null,
                                needsSetup
                                  ? jsx(McpSetupButton, {
                                      profile: bot,
                                      entry: m,
                                      onDone: () => toggleMcp(m.name, true)
                                    })
                                  : null,
                                m.description
                                  ? jsx('div', {
                                      className: 'truncate text-[0.65rem] leading-4 text-(--ui-text-quaternary)',
                                      children: m.description
                                    })
                                  : null
                              ]
                            })
                          ]
                        },
                        m.name
                      )
                    })
                  })
                })
        })
      ),
      labeled(
        t('config.soul'),
        jsx(Textarea, {
          className: 'min-h-28 font-mono text-xs leading-5',
          value: state.soul,
          onChange: event => setState(prev => ({ ...prev, dirtySoul: true, soul: event.target.value }))
        })
      )
    ]
  })
}

// ── skills hub section: the REAL hub page (docs) embedded as a picker ──────
// https://work4you.ai/docs/skills?embed=picker hides the
// docs chrome and adds "+ Add to this Agent" per card, posting
// {type: 'work4you-skill-pick', ...} to us (work4you#86243). We validate
// the origin, install via skills.manage, and bubble onInstalled so the
// checklist above gains the row. Search-box fallback kept for offline use.

const HUB_ORIGIN = 'https://work4you.ai'
const HUB_PICKER_URL = HUB_ORIGIN + '/docs/skills?embed=picker'

function HubSkillsSection({ forProfile, onInstalled }) {
  const t = useBotModeT()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [searching, setSearching] = useState(false)
  const [installing, setInstalling] = useState(null)
  const [installed, setInstalled] = useState({})
  const [browseHub, setBrowseHub] = useState(false)
  const installRef = useRef(null)
  const frameRef = useRef(null)

  // Picker messages from the embedded hub page. Origin- AND source-checked —
  // only OUR frame may ask for an install (the hub origin alone would let any
  // other window on it, e.g. an OAuth popup, trigger installs too); installs
  // route through the same install() the search fallback uses.
  useEffect(() => {
    if (!browseHub) {
      return undefined
    }

    const onMessage = event => {
      if (event.origin !== HUB_ORIGIN) {
        return
      }

      if (!frameRef.current || event.source !== frameRef.current.contentWindow) {
        return
      }

      const data = event.data

      if (!data || data.type !== 'work4you-skill-pick' || !data.name) {
        return
      }

      const target = String(data.identifier || data.name)

      // Skill identifiers are slugs / owner-name paths — keep anything
      // else out of skills.manage.
      if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(target)) {
        return
      }

      if (installRef.current) {
        void installRef.current(target, String(data.name))
      }
    }

    window.addEventListener('message', onMessage)

    return () => window.removeEventListener('message', onMessage)
  }, [browseHub])

  const search = async () => {
    const q = query.trim()

    if (!q || searching) {
      return
    }

    setSearching(true)
    setResults(null)

    try {
      const res = await host.request('skills.manage', { action: 'search', query: q })
      setResults(res.results || [])
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  const install = async (name, displayName) => {
    const label = displayName || name

    if (installing) {
      return
    }

    setInstalling(label)

    try {
      // With forProfile the install lands in that bot's skills dir
      // (gateway skills.manage profile scoping); null = launch profile,
      // which is right at create time — the new bot clones/copies from it.
      await host.request('skills.manage', {
        action: 'install',
        query: name,
        ...(forProfile ? { profile: forProfile } : {})
      })
      setInstalled(prev => ({ ...prev, [label]: true }))
      host.notify({ kind: 'success', message: t('hub.installed', label) })

      if (typeof onInstalled === 'function') {
        onInstalled(label)
      }
    } catch (err) {
      host.notifyError(err, t('hub.installFailed', label))
    } finally {
      setInstalling(null)
    }
  }

  installRef.current = install

  return jsxs('div', {
    className: 'grid gap-1.5 border-t border-(--ui-stroke-secondary) pt-2',
    children: [
      jsxs('div', {
        className: 'flex items-baseline justify-between gap-2',
        children: [
          jsx('div', {
            className: 'text-[0.7rem] font-medium text-(--ui-text-secondary)',
            children: t('hub.title')
          }),
          jsx('button', {
            type: 'button',
            className: 'text-[0.65rem] text-(--ui-text-quaternary) hover:text-(--ui-text-secondary)',
            onClick: () => setBrowseHub(v => !v),
            children: browseHub ? t('hub.hideBrowser') : t('hub.browseFull')
          })
        ]
      }),
      browseHub
        ? jsxs('div', {
            className: 'grid gap-1',
            children: [
              // Resizable viewport: native CSS resize handle (bottom-right
              // corner) lets the user drag it larger/smaller. The iframe
              // inside is rendered oversized and scaled DOWN (133% × 0.75)
              // so the hub page starts zoomed out — we can't style the
              // cross-origin page itself, but scaling the frame is ours.
              jsx('div', {
                style: {
                  width: '100%',
                  height: 560,
                  minHeight: 240,
                  minWidth: 320,
                  maxWidth: '100%',
                  resize: 'both',
                  overflow: 'hidden',
                  border: '1px solid var(--ui-stroke-secondary)',
                  borderRadius: 8,
                  position: 'relative'
                },
                children: jsx('iframe', {
                  src: HUB_PICKER_URL,
                  title: t('hub.frameTitle'),
                  ref: frameRef,
                  style: {
                    width: '133.34%',
                    height: '133.34%',
                    border: 'none',
                    background: 'transparent',
                    transform: 'scale(0.75)',
                    transformOrigin: 'top left'
                  },
                  sandbox: 'allow-scripts allow-same-origin'
                })
              }),
              jsx('div', {
                className: 'px-1 text-[0.65rem] leading-4 text-(--ui-text-quaternary)',
                children: installing ? t('hub.installing', installing) : t('hub.pickerHint')
              })
            ]
          })
        : null,
      jsxs('div', {
        className: 'flex gap-1.5',
        children: [
          jsx(Input, {
            className: 'h-7 flex-1 text-xs',
            placeholder: t('hub.searchPlaceholder'),
            value: query,
            onChange: event => setQuery(event.target.value),
            onKeyDown: event => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void search()
              }
            }
          }),
          jsx(Button, {
            size: 'sm',
            variant: 'secondary',
            disabled: searching || !query.trim(),
            onClick: () => void search(),
            children: searching ? t('hub.searching') : t('hub.search')
          })
        ]
      }),
      searching
        ? jsx('div', {
            className: 'px-1 text-[0.65rem] text-(--ui-text-quaternary)',
            children: t('hub.searchingHint')
          })
        : null,
      results === null
        ? null
        : results.length === 0
          ? jsx('div', {
              className: 'px-1 py-1.5 text-[0.7rem] text-(--ui-text-quaternary)',
              children: t('hub.noResults')
            })
          : jsx(ScrollArea, {
              className: 'work4you-scroll-cap',
              style: { maxHeight: 150 },
              children: jsx('div', {
                className: 'grid gap-1',
                children: results.map(r =>
                  jsxs(
                    'div',
                    {
                      className: 'flex items-center gap-2 text-xs',
                      children: [
                        jsxs('div', {
                          className: 'min-w-0 flex-1',
                          children: [
                            jsx('div', { className: 'truncate font-medium', children: r.name }),
                            r.description
                              ? jsx('div', {
                                  className: 'truncate text-[0.65rem] text-(--ui-text-quaternary)',
                                  children: r.description
                                })
                              : null
                          ]
                        }),
                        installed[r.name]
                          ? jsx('span', {
                              className: 'shrink-0 text-[0.65rem] text-(--ui-text-tertiary)',
                              children: t('hub.added')
                            })
                          : jsx(Button, {
                              size: 'sm',
                              variant: 'ghost',
                              className: 'shrink-0 px-2 font-semibold',
                              disabled: installing !== null,
                              title: t('hub.installTitle', r.name),
                              onClick: () => void install(r.name),
                              children: installing === r.name ? '…' : '+'
                            })
                      ]
                    },
                    r.name
                  )
                )
              })
            })
    ]
  })
}

function emptyAdvancedState() {
  return {
    loaded: false,
    provider: '',
    model: '',
    soul: '',
    skills: [],
    toolsets: [],
    mcp: [],
    dirtyModel: false,
    dirtySoul: false,
    dirtySkills: false,
    dirtyToolsets: false,
    dirtyMcp: false
  }
}

/** Persist only the dirty sections of the advanced editor. */
async function applyAdvancedConfig(bot, state) {
  const payload = { name: bot }
  const applied = {}

  if (state.dirtySoul) {
    payload.soul = ensureMessagingProtocol(state.soul, bot, $lastRoster.get())
  }

  if (state.dirtyModel) {
    const model = state.model.trim()
    const provider = state.provider.trim()

    if (model && provider) {
      payload.model = model
      payload.provider = provider
    } else if (!model && !provider) {
      try {
        const result = await host.request('cli.exec', {
          argv: ['--profile', bot, 'config', 'unset', 'model']
        })
        applied.model = result?.blocked !== true && result?.code === 0
      } catch {
        applied.model = false
      }
    } else {
      applied.model = false
    }
  }

  if (state.dirtySkills) {
    payload.disabled_skills = state.skills.filter(s => !s.enabled).map(s => s.name)
  }

  if (state.dirtyToolsets) {
    const all = state.toolsets.length
    const enabled = state.toolsets.filter(t => t.enabled)
    // All enabled (or none) = clear the pin; otherwise pin the checked set.
    payload.enabled_toolsets = enabled.length === all || enabled.length === 0 ? [] : enabled.map(t => t.name)
  }

  if (state.dirtyMcp) {
    payload.enabled_mcp_servers = (state.mcp || []).filter(m => m.enabled).map(m => m.name)
  }

  if (Object.keys(payload).length === 1) {
    return { ok: Object.values(applied).every(Boolean), applied }
  }

  const result = await host.request('profiles.configure', payload)
  const merged = { ...applied, ...(result?.applied || {}) }

  return { ...result, ok: Object.values(merged).every(Boolean), applied: merged }
}

// ── edit profile dialog ──────────────────────────────────────────────────────

const fieldLabelClass =
  'text-[length:var(--conversation-caption-font-size)] font-semibold leading-(--conversation-caption-line-height) text-(--ui-text-secondary)'

const hintClass =
  'text-[length:var(--conversation-caption-font-size)] font-normal leading-(--conversation-caption-line-height) text-(--ui-text-secondary)'

const choiceClass =
  '[&_button]:text-[length:var(--conversation-text-font-size)] [&_button]:text-(--ui-text-secondary) [&_button[aria-pressed=true]]:font-semibold [&_button[aria-pressed=true]]:text-(--ui-text-primary)'

function labeled(label, control) {
  return jsxs('div', {
    className: 'flex w-full min-w-0 flex-col gap-1.5',
    children: [
      jsx('label', {
        className: fieldLabelClass,
        htmlFor: control?.props?.id,
        children: label
      }),
      control
    ]
  })
}

function EditProfileDialog({ bot, open, onClose }) {
  const t = useBotModeT()
  const metaAll = useValue($botMeta)
  const meta = bot ? metaAll[bot.name] : null
  const appearance = bot ? botAppearance(bot.name, meta) : { shape: 'circle', color: AVATAR_COLORS[3] }
  const [shape, setShape] = useState(appearance.shape)
  const [color, setColor] = useState(appearance.color)
  const [image, setImage] = useState(appearance.image)
  const [title, setTitle] = useState(meta?.title || '')
  const [description, setDescription] = useState(bot?.description || '')
  const [busy, setBusy] = useState(false)
  const [advanced, setAdvanced] = useState(false)
  const [adv, setAdv] = useState(emptyAdvancedState())

  // Re-seed local state each time a different bot opens the dialog.
  const [seedKey, setSeedKey] = useState(null)
  const currentKey = bot ? `${bot.name}:${open}` : null
  if (currentKey !== seedKey) {
    setSeedKey(currentKey)
    if (bot && open) {
      setShape(appearance.shape)
      setColor(appearance.color)
      setImage(appearance.image)
      setTitle(meta?.title || '')
      setDescription(bot.description || '')
      setBusy(false)
      setAdvanced(false)
      setAdv(emptyAdvancedState())
    }
  }

  if (!bot) {
    return null
  }

  const submit = async () => {
    if (busy) {
      return
    }

    setBusy(true)
    let advancedFailed = false
    const persistence = await saveBotMeta(bot.name, {
      shape,
      color,
      image,
      imageKind: image ? 'photo' : 'shape',
      title: title.trim(),
      custom: true
    })
    // Only an explicit remote failure is an error — 'unsupported' is the
    // documented older-gateway fallback (local wins, silently), and toasting
    // it would flag every save on every legacy setup forever.
    const lookFailed = persistence.serverOutcome === 'failed'

    if (lookFailed) {
      host.notify({ kind: 'error', message: t('edit.lookRemoteFailed') })
    }
    if (persistence.serverOutcome === 'persisted') {
      queryClient.invalidateQueries({ queryKey: ROSTER_KEY })
    }

    const desc = description.trim()
    if (desc !== (bot.description || '').trim()) {
      try {
        await host.request('cli.exec', {
          argv: ['profile', 'describe', bot.name, '--text', desc]
        })
        queryClient.invalidateQueries({ queryKey: ROSTER_KEY })
      } catch (err) {
        host.notifyError(err, t('edit.descriptionFailed'))
      }
    }

    if (adv.loaded && (adv.dirtyModel || adv.dirtySoul || adv.dirtySkills || adv.dirtyToolsets || adv.dirtyMcp)) {
      try {
        const res = await applyAdvancedConfig(bot.name, adv)
        const failed = Object.entries(res?.applied || {}).filter(([, ok]) => !ok)

        if (failed.length) {
          advancedFailed = true
          host.notify({ kind: 'error', message: t('edit.sectionsFailed', failed.map(([k]) => k).join(', ')) })
        }
      } catch (err) {
        advancedFailed = true
        host.notifyError(err, t('edit.advancedFailed'))
      }
    }

    if (!advancedFailed && !lookFailed) {
      host.notify({ kind: 'success', message: t('edit.updated', displayName(bot, { title })) })
    }
    setBusy(false)
    onClose()
  }

  return jsx(Dialog, {
    open,
    onOpenChange: value => !value && !busy && onClose(),
    children: jsxs(DialogContent, {
      'data-panel-card': '',
      className: cn('min-w-0', advanced ? 'max-w-3xl' : 'max-w-sm'),
      bodyClassName: 'min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-4 overflow-hidden',
      children: [
        jsxs(DialogHeader, {
          children: [
            jsx(DialogTitle, { children: t('edit.title') }),
            jsx(DialogDescription, { children: t('edit.subtitle', displayName(bot, null), bot.name) })
          ]
        }),
        jsxs('div', {
          className: 'grid min-h-0 min-w-0 gap-4 overflow-y-auto overflow-x-hidden',
          children: [
            jsx('div', {
              className: 'flex justify-center py-1',
              children: jsx(BotFace, { shape, color, image, size: 64, name: bot.name })
            }),
            jsx(AvatarPicker, {
              shape,
              color,
              image,
              onShape: setShape,
              onColor: setColor,
              onImage: setImage,
              generateSeed: { name: bot.name, title, description }
            }),
            labeled(
              t('common.title'),
              jsx(Input, {
                placeholder: displayName(bot, null),
                value: title,
                onChange: event => setTitle(event.target.value)
              })
            ),
            labeled(
              t('common.description'),
              jsx(Textarea, {
                className: 'min-h-16',
                placeholder: t('edit.descriptionPlaceholder'),
                value: description,
                onChange: event => setDescription(event.target.value)
              })
            ),
            jsxs(Button, {
              type: 'button',
              variant: 'ghost',
              size: 'sm',
              className: 'w-fit text-[length:var(--conversation-text-font-size)] font-medium text-(--ui-text-primary)',
              onClick: () => setAdvanced(v => !v),
              children: [jsx(Codicon, { name: advanced ? 'chevron-down' : 'chevron-right' }), t('edit.advanced')]
            }),
            advanced
              ? jsx('div', {
                  className: 'grid min-w-0 gap-4 border-t border-(--ui-stroke-tertiary) pt-4',
                  children: jsx(AdvancedProfileConfig, { bot: bot.name, state: adv, setState: setAdv })
                })
              : null
          ]
        }),
        jsxs(DialogFooter, {
          className: 'min-w-0 border-t border-(--ui-stroke-tertiary) pt-3',
          children: [
            jsx(Button, { variant: 'ghost', disabled: busy, onClick: onClose, children: t('common.cancel') }),
            jsx(Button, { disabled: busy, onClick: submit, children: busy ? t('common.saving') : t('common.save') })
          ]
        })
      ]
    })
  })
}

// ── create dialog ────────────────────────────────────────────────────────────
// Fresh create (no clone) must not inherit the launch home's config, skills,
// .env, or messaging tokens. The GUI default is this sentinel; Clone from
// default remains an explicit opt-in.
const FRESH_CLONE_FROM = '__none__'
// House-model pin (Work4You + Operis). Fresh profiles have no local
// auth.json / .env keys; Inherit left the first agent build on `auto` and
// failed with no_provider_configured. Advanced can still pick Inherit or
// another provider. The model is the SDK's house id — the constant the
// composer uses — so a house-model move cannot leave New Agent on a retired
// id again. Older SDKs without the export get the current wire id.
const DEFAULT_CREATE_PROVIDER = 'work4you'
const DEFAULT_CREATE_MODEL =
  (typeof sdk !== 'undefined' &&
    typeof sdk.WORK4YOU_HOUSE_MODEL_ID === 'string' &&
    sdk.WORK4YOU_HOUSE_MODEL_ID) ||
  'openai/gpt-6-luna'

function isFreshProfileCreate(cloneFrom) {
  return cloneFrom == null || cloneFrom === '' || cloneFrom === FRESH_CLONE_FROM
}

function capabilityCatalogSource(cloneFrom, remoteTarget = false) {
  if (isFreshProfileCreate(cloneFrom)) return 'fresh'
  return remoteTarget ? 'default' : cloneFrom
}

function profilesCreateIsolationParams(cloneFrom, remoteTarget = false) {
  const fresh = isFreshProfileCreate(cloneFrom)
  return {
    clone_from: fresh ? null : remoteTarget ? 'default' : cloneFrom,
    // Clones already copy the source .env via create_profile. Fresh must not
    // overlay the launch home's WhatsApp tokens / API keys.
    mirror_credentials: false
  }
}

function profilesCreateModelParams(provider, model) {
  const pinnedProvider = String(provider || '').trim()
  const pinnedModel = String(model || '').trim()
  return pinnedProvider && pinnedModel ? { provider: pinnedProvider, model: pinnedModel } : {}
}

function CreateAgentDialog({ open, onClose, roster }) {
  const t = useBotModeT()
  const [name, setName] = useState('')
  // Create mode: the profile is created LAZILY. Capability toggles are staged in
  // component state; the profile is materialized either on Create (submit) or on
  // the first MCP credential setup (ensureAgentCreated), whichever comes first —
  // so OAuth / API-key setup works DURING creation, not only after in Edit.
  const createdRef = useRef(null)
  // In-flight profiles.create shared across concurrent triggers (Create
  // button + MCP setup buttons). Distinct from createdRef on purpose:
  // createdRef must stay a slug string for its sibling consumers.
  const flightRef = useRef(null)
  const draftEpoch = useRef(0)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  // Match New profile: an untouched appearance follows the profile name.
  const [shape, setShape] = useState(avatarSdk.AvatarPicker ? null : blobatarSvg ? 'blobatar' : 'circle')
  const [color, setColor] = useState(avatarSdk.AvatarPicker ? null : AVATAR_COLORS[3])
  const [image, setImage] = useState(null)
  const [page, setPage] = useState('identity')
  const [cloneFrom, setCloneFrom] = useState(FRESH_CLONE_FROM)
  const [model, setModel] = useState(DEFAULT_CREATE_MODEL)
  const [provider, setProvider] = useState(DEFAULT_CREATE_PROVIDER)
  const [soul, setSoul] = useState('')
  const [advTab, setAdvTab] = useState('general')
  // Where the profile is created: '' = the active gateway (unchanged default),
  // else a registry connection id — the profiles.create lands on THAT
  // machine's backend via host.requestProfile, no gateway switch. Only
  // rendered when the desktop has a multi-connection registry.
  const [targetConnection, setTargetConnection] = useState('')
  const [connections, setConnections] = useState(null)

  useEffect(() => {
    if (
      !open ||
      connections !== null ||
      typeof host.connections !== 'function' ||
      typeof host.requestProfile !== 'function'
    ) {
      return
    }

    host
      .connections()
      // host.connections() returns the registry ROWS on current SDKs, but the
      // envelope object ({version, primary, connections: [...]}) on desktops
      // that predate the SDK-side unwrap — accept both shapes.
      .then(value =>
        setConnections(Array.isArray(value) ? value : Array.isArray(value?.connections) ? value.connections : [])
      )
      .catch(() => setConnections([]))
  }, [open, connections])

  const activeConnectionId = String(host.state?.connectionId?.get?.() || '').trim()
  // Remote target = an explicitly picked registry connection that is not the
  // one this window is already on.
  const remoteTarget = Boolean(targetConnection) && targetConnection !== (activeConnectionId || 'local')
  const targetLabel = remoteTarget
    ? (connections || []).find(c => c.id === targetConnection)?.label || targetConnection
    : ''

  /** Gateway RPC on the create target: the picked connection's default
   *  backend for remote targets, the active gateway otherwise. */
  const requestForTarget = (method, params = {}) =>
    remoteTarget
      ? host.requestProfile(
          { connectionId: targetConnection, mode: 'remote', profile: 'default', targetProfile: 'default' },
          method,
          params
        )
      : host.request(method, params)

  // Set once ensureAgentCreated() materializes the profile for the live
  // Capabilities tab (SkillsView needs a real backend to point at). State —
  // not just createdRef — because the render must flip when it lands.
  const [createdForCaps, setCreatedForCaps] = useState(null)
  const [caps, setCaps] = useState(null)
  const [capsFailed, setCapsFailed] = useState(false)
  const [dirtyCaps, setDirtyCaps] = useState({ skills: false, toolsets: false, mcp: false })
  const [capFilter, setCapFilter] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const slug = slugify(name)
  const valid = slug.length > 0 && NAME_RE.test(slug)
  // Once the draft profile is materialized (Capabilities tab / MCP setup) it
  // shows up in the roster — its OWN slug must not read as "taken".
  // A remote-target create is gated by the TARGET machine's roster: a local
  // name clash is fine there, and the remote's own duplicate check rejects
  // real collisions at profiles.create time.
  const taken = remoteTarget
    ? roster.some(
        b => b.remoteSource && b.connectionId === targetConnection && b.name === slug && b.name !== createdRef.current
      )
    : roster.some(b => !b.remoteSource && b.name === slug && b.name !== createdRef.current)

  // Draft semantics for the lazily-created profile: opening the Capabilities
  // tab (or running MCP setup) materializes the profile so the LIVE config
  // surfaces have a real backend to write to — but until the user hits
  // Create Agent it is a DRAFT. Cancelling the dialog deletes it, so
  // preconfigure-then-back-out leaves zero residue. Best-effort and
  // fire-and-forget: a failed cleanup surfaces a toast, never blocks close.
  const discardDraft = () => {
    draftEpoch.current += 1
    const draft = createdRef.current

    if (!draft) {
      return
    }

    createdRef.current = null
    flightRef.current = null
    const discard = remoteTarget
      ? requestForTarget('cli.exec', { argv: ['profile', 'delete', draft, '--yes'] })
      : deleteBot({ name: draft })
    void Promise.resolve(discard)
      .then(() => host.notify({ kind: 'success', message: t('create.draftDiscarded', draft) }))
      .catch(err => host.notifyError(err, t('create.draftCleanupFailed', draft)))
  }

  const reset = () => {
    draftEpoch.current += 1
    setName('')
    setTitle('')
    setDescription('')
    setShape(avatarSdk.AvatarPicker ? null : blobatarSvg ? 'blobatar' : 'circle')
    setColor(avatarSdk.AvatarPicker ? null : AVATAR_COLORS[3])
    setImage(null)
    setPage('identity')
    // Same default as the initial useState — Fresh, not clone-from-default.
    setCloneFrom(FRESH_CLONE_FROM)
    setModel(DEFAULT_CREATE_MODEL)
    setProvider(DEFAULT_CREATE_PROVIDER)
    setSoul('')
    setAdvTab('general')
    setCreatedForCaps(null)
    setCaps(null)
    setCapsFailed(false)
    setDirtyCaps({ skills: false, toolsets: false, mcp: false })
    setCapFilter('')
    setTargetConnection('')
    setBusy(false)
    setError(null)
    createdRef.current = null
    flightRef.current = null
  }

  // Capability catalog for the staging tabs: a clone preview shows that
  // source's list. Fresh must NOT fall back to default's catalog — that made
  // a blank agent look like it already had the main profile's skills/MCP.
  const capSource = capabilityCatalogSource(cloneFrom, remoteTarget)
  const capSourceRef = useRef(capSource)
  capSourceRef.current = capSource
  const ensureCaps = () => {
    if (capsFailed) {
      return
    }

    if (capSource === 'fresh') {
      if (!caps || caps.source !== 'fresh') {
        setCaps({ source: 'fresh', skills: [], toolsets: [], mcp: [] })
      }
      return
    }

    if (caps && caps.source === capSource) {
      return
    }

    const requested = capSource

    Promise.all([
      requestForTarget('profiles.describe', { name: requested }),
      requestForTarget('mcp.catalog', {}).catch(() => null)
    ])
      .then(([res, cat]) => {
        if (capSourceRef.current !== requested) {
          return
        }

        // Full MCP menu = the profile's configured servers + the bundled
        // catalog (installable). Configured entries win on name clash.
        const configured = res.mcp_servers || []
        const have = new Set(configured.map(m => m.name))
        const catalog = ((cat && cat.servers) || []).filter(s => !have.has(s.name))

        setCaps({
          source: requested,
          skills: res.skills || [],
          toolsets: res.toolsets || [],
          mcp: [
            ...configured,
            ...catalog.map(s => ({
              name: s.name,
              enabled: false,
              fromCatalog: true,
              installed: s.installed,
              auth: s.auth,
              requires: s.requires || [],
              description: s.description || ''
            }))
          ]
        })
      })
      .catch(() => {
        if (capSourceRef.current === requested) {
          setCapsFailed(true)
        }
      })
  }

  useEffect(() => {
    if (!open || page !== 'capabilities') {
      return
    }
    if (advTab === 'general' || advTab === 'capabilities') {
      return
    }
    ensureCaps()
  }, [open, page, advTab, capSource])

  const toggleCap = (kind, name, enabled) => {
    setDirtyCaps(prev => ({ ...prev, [kind === 'mcp' ? 'mcp' : kind]: true }))
    setCaps(prev => (prev ? { ...prev, [kind]: prev[kind].map(x => (x.name === name ? { ...x, enabled } : x)) } : prev))
  }

  // Materialize the profile exactly once. createdRef stores the finished slug
  // (its consumers — the taken check, draft discard on cancel, the MCP setup
  // button's profile param — all read a string); flightRef shares the
  // in-flight creation promise so simultaneous MCP setup / Create clicks fire
  // ONE profiles.create. A settled flight clears its slot: failures retry,
  // and a null result (form invalid at flight time) isn't sticky.
  const ensureAgentCreated = () => {
    // Renamed since the draft materialized? The old draft is orphaned —
    // discard it and create fresh under the new slug.
    if (createdRef.current && createdRef.current !== slug) {
      discardDraft()
      setCreatedForCaps(null)
    }

    if (createdRef.current) {
      return Promise.resolve(createdRef.current)
    }

    const epoch = draftEpoch.current
    const flight = singleFlight(flightRef, async () => {
      if (!valid || taken) {
        return null
      }

      const descriptionText = [title, description].filter(Boolean).join(' — ')

      await requestForTarget('profiles.create', {
        name: slug,
        description: descriptionText,
        // Clone sources are profiles of the TARGET backend. The picker's
        // roster is the local one, so a remote clone uses that machine's
        // default — never a local profile name the remote box doesn't have.
        // Fresh (the dialog default) sends clone_from: null and does not
        // overlay the launch home's .env / WhatsApp tokens.
        ...profilesCreateIsolationParams(cloneFrom, remoteTarget),
        no_skills: false,
        // Use the default profile’s shared platform login. Other copied
        // credentials remain governed by the selected clone source.
        share_auth: true,
        soul: composeSoul({ name: slug, title, description, roster, customSoul: soul }),
        ...profilesCreateModelParams(provider, model)
      })

      // Cancellation can arrive while profiles.create is still in flight.
      // Dispose of that result on its original connection instead of reviving
      // the closed dialog or leaving an invisible draft in the roster.
      if (epoch !== draftEpoch.current) {
        try {
          if (remoteTarget) {
            await requestForTarget('cli.exec', { argv: ['profile', 'delete', slug, '--yes'] })
          } else {
            await deleteBot({ name: slug })
          }
        } catch (err) {
          host.notifyError(err, t('create.draftCleanupFailed', slug))
        }
        return null
      }
      createdRef.current = slug

      // Apply capability picks from the Advanced tabs (best-effort; the
      // profile exists either way and Edit Profile can finish the job).
      try {
        const capPayload = {}

        if (dirtyCaps.skills && caps) {
          capPayload.disabled_skills = caps.skills.filter(s => !s.enabled).map(s => s.name)
        }
        if (dirtyCaps.toolsets && caps) {
          const en = caps.toolsets.filter(t => t.enabled)
          capPayload.enabled_toolsets = en.length === caps.toolsets.length || en.length === 0 ? [] : en.map(t => t.name)
        }
        if (dirtyCaps.mcp && caps) {
          capPayload.enabled_mcp_servers = caps.mcp.filter(m => m.enabled).map(m => m.name)
        }
        if (Object.keys(capPayload).length) {
          await requestForTarget('profiles.configure', { name: slug, ...capPayload })
        }
      } catch {
        /* capability application is best-effort */
      }

      if (remoteTarget) {
        // The bot lives on ANOTHER machine — local bot-meta is scoped to the
        // active gateway, so write appearance/title into the remote
        // profile's ui_meta (and asset store) directly. Best-effort: the
        // profile exists either way.
        const { image: avatarImage, ...look } = {
          shape,
          color,
          image,
          imageKind: image ? 'photo' : 'shape',
          title: title.trim(),
          created: Date.now()
        }

        try {
          void requestForTarget('profiles.configure', { name: slug, ui_meta: { 'work4you-bots': look } }).catch(
            () => undefined
          )

          if (avatarImage) {
            void requestForTarget('profiles.set_asset', { name: slug, asset: 'avatar', data: avatarImage }).catch(
              () => undefined
            )
          }
        } catch {
          /* older remote gateway */
        }
      } else {
        saveBotMeta(slug, {
          shape,
          color,
          image,
          imageKind: image ? 'photo' : 'shape',
          title: title.trim(),
          created: Date.now()
        })
      }

      queryClient.invalidateQueries({ queryKey: ROSTER_KEY })
      return slug
    })

    return flight
  }

  const saveDraftDetails = async draft => {
    const look = { shape, color, imageKind: image ? 'photo' : 'shape', title: title.trim() }
    const result = await requestForTarget('profiles.configure', {
      name: draft,
      description: [title, description].filter(Boolean).join(' — '),
      soul: composeSoul({ name: draft, title, description, roster, customSoul: soul }),
      ...profilesCreateModelParams(provider, model),
      ui_meta: { 'work4you-bots': look }
    })
    if (result?.ok === false || Object.values(result?.applied || {}).some(value => value === false)) {
      throw new Error(t('create.failed'))
    }
    if (!provider && !model) {
      const cleared = await requestForTarget('cli.exec', { argv: ['--profile', draft, 'config', 'unset', 'model'] })
      if (cleared?.blocked || cleared?.code !== 0) throw new Error(t('create.failed'))
    }
    if (remoteTarget) {
      await requestForTarget('profiles.set_asset', {
        name: draft,
        asset: 'avatar',
        ...(image ? { data: image } : { clear: true })
      })
    } else {
      await saveBotMeta(draft, { ...look, image })
    }
  }

  const submit = async () => {
    if (!valid || taken || busy) {
      return
    }

    setBusy(true)
    setError(null)

    try {
      const slugCreated = await ensureAgentCreated()
      if (!slugCreated) {
        setBusy(false)
        setError(t('create.failed'))
        return
      }

      // Capabilities may have materialized the profile before the user went
      // back and edited its identity, instructions, model or appearance.
      // Save only those details here; the live capability choices stay intact.
      await saveDraftDetails(slugCreated)

      host.notify({
        kind: 'success',
        message: remoteTarget
          ? t('create.createdOn', displayName({ name: slug, title }), targetLabel)
          : t('create.created', displayName({ name: slug, title }))
      })
      const wasRemote = remoteTarget
      // Snapshot before reset() restores the dialog defaults — a user who
      // picked Inherit or another provider in Advanced must keep that pin.
      const createRuntime = profilesCreateModelParams(provider, model)
      reset()
      onClose()

      if (wasRemote) {
        // The bot lives on another machine: it appears in the roster via the
        // union enumeration; chat routes through its own source. No local
        // canonical chat to birth here.
        queryClient.invalidateQueries({ queryKey: ROSTER_KEY })
        return
      }

      $selectedBot.set(slug)

      // Birth the bot's forever chat right away: it introduces itself as
      // the first thing the user sees, and the pin exists from minute one.
      try {
        // Creates, pins, opens, and kicks off the intro in one flow.
        // Pin Operis/Portal on the first session.create (not Inherit/auto).
        const sid = await createCanonicalChat(slug, createRuntime)

        if (!sid && typeof host.newChat === 'function') {
          host.newChat(slug)
        }
      } catch {
        if (typeof host.newChat === 'function') {
          host.newChat(slug)
        }
      }
    } catch (err) {
      setBusy(false)
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const liveCapabilities = Boolean(SkillsView && (!remoteTarget || skillsViewRoutesConnections))
  const openCapabilities = () => {
    const epoch = draftEpoch.current
    setPage('capabilities')
    setError(null)
    if (liveCapabilities) {
      if (!valid || taken) return
      void ensureAgentCreated()
        .then(created => {
          if (created && epoch === draftEpoch.current) setCreatedForCaps(created)
        })
        .catch(err => {
          if (epoch === draftEpoch.current) setError(err instanceof Error ? err.message : t('create.profileNotReady'))
        })
    } else {
      setAdvTab('skills')
      ensureCaps()
    }
  }
  const appearance = botAppearance(slug || 'agent', { shape, color, custom: true })
  const identityLocked = busy || Boolean(createdForCaps) || Boolean(flightRef.current)
  const clonePicker = labeled(
    remoteTarget ? t('create.cloneFromOn', targetLabel) : t('create.cloneFrom'),
    jsxs(Select, {
      value: cloneFrom,
      disabled: identityLocked,
      onValueChange: value => {
        setCloneFrom(value)
        setCaps(null)
        setCapsFailed(false)
      },
      children: [
        jsx(SelectTrigger, { 'aria-label': t('create.cloneFrom'), children: jsx(SelectValue, {}) }),
        jsx(SelectContent, {
          children: (remoteTarget ? [{ name: 'default' }] : roster.filter(b => !b.remoteSource)).map(b =>
            jsx(SelectItem, { value: b.name, children: b.name }, b.name)
          )
        })
      ]
    })
  )
  const legacyCapabilities = capsFailed
    ? jsx('div', {
        className: 'px-2 py-3 text-center text-xs text-(--ui-text-tertiary)',
        children: t('create.catalogNeedsGateway')
      })
    : !caps
      ? jsx('div', {
          className: 'flex justify-center py-4',
          children: jsx(GlyphSpinner, {
            spinner: 'breathe',
            className: 'text-(--ui-text-tertiary)'
          })
        })
      : advTab === 'skills'
        ? caps.source === 'fresh'
          ? jsx('div', {
              className: 'px-2 py-3 text-center text-xs text-(--ui-text-tertiary)',
              children: t('create.freshSkillsHint')
            })
          : jsxs('div', {
              className: 'grid gap-1.5',
              children: [
                jsx(Input, {
                  className: 'h-7 text-xs',
                  placeholder: t('config.filterSkills'),
                  value: capFilter,
                  onChange: event => setCapFilter(event.target.value)
                }),
                jsx(ScrollArea, {
                  className: 'work4you-scroll-cap',
                  style: { maxHeight: 200 },
                  children: jsx(CheckList, {
                    items: capFilter.trim()
                      ? caps.skills.filter(s => s.name.toLowerCase().includes(capFilter.trim().toLowerCase()))
                      : caps.skills,
                    onToggle: (name, enabled) => toggleCap('skills', name, enabled),
                    columns: 2
                  })
                }),
                jsx('div', {
                  className: 'text-[0.65rem] leading-4 text-(--ui-text-quaternary)',
                  children: t('create.catalogFrom', caps.source)
                }),
                jsx(HubSkillsSection, {
                  forProfile: null,
                  onInstalled: name =>
                    setCaps(prev =>
                      !prev || prev.skills.some(s => s.name === name)
                        ? prev
                        : { ...prev, skills: [...prev.skills, { name, enabled: true }] }
                    )
                })
              ]
            })
        : advTab === 'toolsets'
          ? jsxs('div', {
              className: 'grid gap-1.5',
              children: [
                jsx(ScrollArea, {
                  className: 'work4you-scroll-cap',
                  style: { maxHeight: 200 },
                  children: jsx(CheckList, {
                    items: caps.toolsets,
                    onToggle: (name, enabled) => toggleCap('toolsets', name, enabled),
                    columns: 2
                  })
                }),
                jsx('div', {
                  className: 'text-[0.65rem] leading-4 text-(--ui-text-quaternary)',
                  children: t('create.toolsetsHint')
                })
              ]
            })
          : caps.mcp.length === 0
            ? jsx('div', {
                className: 'px-2 py-3 text-center text-xs text-(--ui-text-tertiary)',
                children: t('config.noMcp')
              })
            : jsxs('div', {
                className: 'grid gap-1.5',
                children: [
                  jsx(ScrollArea, {
                    className: 'work4you-scroll-cap',
                    style: { maxHeight: 200 },
                    children: jsx('div', {
                      className: 'grid gap-1',
                      children: caps.mcp.map(m => {
                        const needsSetup =
                          m.fromCatalog &&
                          !m.installed &&
                          ((m.requires || []).length > 0 || (m.auth || '').toLowerCase() === 'oauth')

                        return jsxs(
                          'label',
                          {
                            className: 'flex items-start gap-2 text-xs text-(--ui-text-secondary)',
                            children: [
                              jsx(Checkbox, {
                                checked: !!m.enabled,
                                disabled: needsSetup,
                                onCheckedChange: value => toggleCap('mcp', m.name, Boolean(value))
                              }),
                              jsxs('span', {
                                className: 'min-w-0',
                                children: [
                                  jsx('span', { children: m.name }),
                                  m.fromCatalog && !needsSetup
                                    ? jsx('span', {
                                        className: 'ml-1.5 text-[0.65rem] text-(--ui-text-quaternary)',
                                        children: m.installed ? t('config.catalogInstalled') : t('config.catalog')
                                      })
                                    : null,
                                  needsSetup
                                    ? jsx(McpSetupButton, {
                                        profile: createdRef.current,
                                        entry: m,
                                        ensureProfile: ensureAgentCreated,
                                        onDone: () => {
                                          // Setup done: mark installed so the row's
                                          // checkbox un-disables, and enable it.
                                          setCaps(prev =>
                                            prev
                                              ? {
                                                  ...prev,
                                                  mcp: prev.mcp.map(x =>
                                                    x.name === m.name ? { ...x, installed: true, enabled: true } : x
                                                  )
                                                }
                                              : prev
                                          )
                                          setDirtyCaps(prev => ({ ...prev, mcp: true }))
                                        }
                                      })
                                    : null,
                                  m.description
                                    ? jsx('div', {
                                        className: 'truncate text-[0.65rem] leading-4 text-(--ui-text-quaternary)',
                                        children: m.description
                                      })
                                    : null
                                ]
                              })
                            ]
                          },
                          m.name
                        )
                      })
                    })
                  }),
                  jsx('div', {
                    className: 'text-[0.65rem] leading-4 text-(--ui-text-quaternary)',
                    children: t('create.mcpHint')
                  })
                ]
              })

  return jsx(Dialog, {
    open,
    onOpenChange: value => {
      if (!value && !busy) {
        discardDraft()
        reset()
        onClose()
      }
    },
    children: jsxs(DialogContent, {
      'data-profile-creation': '',
      bodyClassName: 'profile-creation-shell',
      children: [
        jsxs(DialogHeader, {
          className: 'profile-creation-header',
          children: [
            page !== 'identity' &&
              jsxs(Button, {
                variant: 'text',
                size: 'sm',
                className: 'mb-2 w-fit',
                type: 'button',
                onClick: () => setPage('identity'),
                children: [jsx(Codicon, { name: 'arrow-left' }), t('create.back')]
              }),
            jsxs('div', {
              className: 'profile-creation-heading',
              children: [
                jsxs('div', {
                  className: 'min-w-0',
                  children: [
                    jsx(DialogTitle, {
                      children:
                        page === 'identity'
                          ? t('create.title')
                          : page === 'settings'
                            ? t('create.settingsTitle')
                            : t('create.tabs.capabilities')
                    }),
                    jsx(DialogDescription, {
                      children:
                        page === 'identity'
                          ? t('create.subtitle')
                          : page === 'settings'
                            ? t('create.settingsDescription')
                            : t('create.capabilitiesDescription')
                    })
                  ]
                }),
                page !== 'identity' &&
                  jsxs('div', {
                    className: 'profile-creation-identity',
                    children: [
                      jsx(BotFace, { ...appearance, image, size: 44, name: slug || 'agent' }),
                      jsxs('div', {
                        className: 'min-w-0 text-sm',
                        children: [
                          jsx('div', { className: 'truncate font-medium', children: title.trim() || slug }),
                          jsx('div', { className: 'truncate text-xs text-(--ui-text-tertiary)', children: slug })
                        ]
                      })
                    ]
                  })
              ]
            })
          ]
        }),
        jsxs('form', {
          className: 'profile-creation-form',
          onSubmit: event => {
            event.preventDefault()
            void submit()
          },
          children: [
            jsxs('fieldset', {
              className: 'profile-creation-body profile-creation-columns',
              hidden: page !== 'identity',
              disabled: busy,
              children: [
                jsxs('div', {
                  className: 'profile-creation-appearance',
                  children: [
                    jsx('div', {
                      className: 'profile-creation-preview',
                      'aria-hidden': true,
                      children: jsx(BotFace, { ...appearance, image, size: 144, name: slug || 'agent' })
                    }),
                    jsx(AvatarPicker, {
                      shape,
                      color,
                      image,
                      onShape: setShape,
                      onColor: setColor,
                      onImage: setImage,
                      presentation: 'creation',
                      generateSeed: { name: slug || 'agent', title, description }
                    }),
                    jsx('p', { className: hintClass, children: t('create.appearanceHint') })
                  ]
                }),
                jsxs('div', {
                  className: 'profile-creation-fields',
                  children: [
                    labeled(
                      t('common.name'),
                      jsx(Input, {
                        id: 'new-agent-name',
                        autoFocus: true,
                        disabled: identityLocked,
                        'aria-invalid': taken,
                        placeholder: t('create.namePlaceholder'),
                        value: name,
                        onChange: event => setName(event.target.value)
                      })
                    ),
                    taken &&
                      jsx('p', {
                        className: hintClass,
                        role: 'alert',
                        children: remoteTarget ? t('create.takenOn', slug, targetLabel) : t('create.taken', slug)
                      }),
                    Array.isArray(connections) &&
                      connections.length > 1 &&
                      labeled(
                        t('create.createOn'),
                        jsxs(Select, {
                          value: targetConnection || activeConnectionId || 'local',
                          disabled: identityLocked,
                          onValueChange: value => {
                            setTargetConnection(value === (activeConnectionId || 'local') ? '' : value)
                            setCaps(null)
                            setCapsFailed(false)
                          },
                          children: [
                            jsx(SelectTrigger, { 'aria-label': t('create.createOn'), children: jsx(SelectValue, {}) }),
                            jsx(SelectContent, {
                              children: connections.map(connection =>
                                jsx(
                                  SelectItem,
                                  {
                                    value: connection.id,
                                    children:
                                      connection.id === (activeConnectionId || 'local')
                                        ? t('create.current', connection.label || connection.id)
                                        : connection.label || connection.id
                                  },
                                  connection.id
                                )
                              )
                            })
                          ]
                        })
                      ),
                    remoteTarget && jsx('p', { className: hintClass, children: t('create.remoteHint', targetLabel) }),
                    labeled(
                      t('common.title'),
                      jsx(Input, {
                        id: 'new-agent-title',
                        value: title,
                        placeholder: t('create.titlePlaceholder'),
                        onChange: event => setTitle(event.target.value)
                      })
                    ),
                    labeled(
                      t('common.description'),
                      jsx(Textarea, {
                        id: 'new-agent-description',
                        value: description,
                        placeholder: t('create.descriptionPlaceholder'),
                        onChange: event => setDescription(event.target.value)
                      })
                    ),
                    jsxs('fieldset', {
                      disabled: identityLocked,
                      className: 'grid gap-2',
                      children: [
                        jsx('span', { className: fieldLabelClass, children: t('create.startFrom') }),
                        jsx(SegmentedControl, {
                          className: 'profile-creation-choice',
                          disabled: identityLocked,
                          value: isFreshProfileCreate(cloneFrom) ? 'fresh' : 'copy',
                          options: [
                            { id: 'fresh', label: t('create.startFresh') },
                            { id: 'copy', label: t('create.startCopy') }
                          ],
                          onChange: value => {
                            if (identityLocked) return
                            setCloneFrom(value === 'fresh' ? FRESH_CLONE_FROM : 'default')
                            setCaps(null)
                            setCapsFailed(false)
                          }
                        }),
                        !isFreshProfileCreate(cloneFrom) && clonePicker
                      ]
                    }),
                    jsxs('div', {
                      className: 'profile-creation-navigation',
                      children: [
                        jsxs(Button, {
                          variant: 'ghost',
                          size: 'lg',
                          type: 'button',
                          onClick: () => setPage('settings'),
                          children: [
                            jsx(Codicon, { name: 'settings' }),
                            jsxs('span', {
                              className: 'flex-1',
                              children: [
                                jsx('span', { className: 'block', children: t('create.settings') }),
                                jsx('span', {
                                  className: 'block text-xs text-(--ui-text-tertiary)',
                                  children: t('create.settingsHint')
                                })
                              ]
                            }),
                            jsx(Codicon, { name: 'chevron-right' })
                          ]
                        }),
                        jsxs(Button, {
                          variant: 'ghost',
                          size: 'lg',
                          type: 'button',
                          onClick: openCapabilities,
                          children: [
                            jsx(Codicon, { name: 'extensions' }),
                            jsxs('span', {
                              className: 'flex-1',
                              children: [
                                jsx('span', { className: 'block', children: t('create.customizeCapabilities') }),
                                jsx('span', {
                                  className: 'block text-xs text-(--ui-text-tertiary)',
                                  children: t('create.capabilitiesHint')
                                })
                              ]
                            }),
                            jsx(Codicon, { name: 'chevron-right' })
                          ]
                        })
                      ]
                    })
                  ]
                })
              ]
            }),
            jsxs('fieldset', {
              className: 'profile-creation-body profile-creation-settings',
              hidden: page !== 'settings',
              disabled: busy,
              children: [
                jsx(ModelPicker, {
                  value: { provider, model },
                  onChange: patch => {
                    if ('provider' in patch) setProvider(patch.provider)
                    if ('model' in patch) setModel(patch.model)
                  },
                  placeholderModel: displayModelName(DEFAULT_CREATE_MODEL)
                }),
                labeled(
                  t('create.instructions'),
                  jsxs('div', {
                    className: 'flex min-h-0 flex-1 flex-col gap-2',
                    children: [
                      jsx('p', { className: hintClass, children: t('create.instructionsHint') }),
                      jsx(Textarea, {
                        id: 'new-agent-instructions',
                        'aria-label': t('create.instructions'),
                        placeholder: t('create.instructionsPlaceholder'),
                        value: soul,
                        onChange: event => setSoul(event.target.value)
                      })
                    ]
                  })
                )
              ]
            }),
            jsx('div', {
              className: 'profile-creation-body profile-creation-capabilities',
              hidden: page !== 'capabilities',
              children: liveCapabilities
                ? !valid || taken
                  ? jsx('p', { className: hintClass, children: taken ? t('create.nameTaken') : t('create.nameFirst') })
                  : createdForCaps
                    ? jsx(SkillsView, {
                        embedded: true,
                        fixedProfile: createdForCaps,
                        hideTitle: true,
                        ...(remoteTarget ? { fixedConnection: targetConnection } : {})
                      })
                    : error
                      ? jsx(Button, {
                          type: 'button',
                          variant: 'secondary',
                          onClick: openCapabilities,
                          children: t('create.retry')
                        })
                      : jsx(GlyphSpinner, { spinner: 'breathe', className: 'text-(--ui-text-tertiary)' })
                : jsxs('div', {
                    className: 'grid gap-4',
                    children: [
                      jsx(SegmentedControl, {
                        value: advTab,
                        options: ['skills', 'toolsets', 'mcp'].map(id => ({ id, label: t(`create.tabs.${id}`) })),
                        onChange: id => {
                          setAdvTab(id)
                          setCapFilter('')
                          ensureCaps()
                        }
                      }),
                      legacyCapabilities
                    ]
                  })
            }),
            jsxs('div', {
              className: 'profile-creation-bottom',
              children: [
                error && jsx('p', { role: 'alert', className: 'text-sm text-destructive', children: error }),
                jsxs(DialogFooter, {
                  children: [
                    jsx(Button, {
                      type: 'button',
                      variant: 'ghost',
                      disabled: busy,
                      onClick: () => {
                        discardDraft()
                        reset()
                        onClose()
                      },
                      children: t('common.cancel')
                    }),
                    jsx(Button, {
                      type: 'submit',
                      disabled: busy || !valid || taken,
                      children: busy ? t('create.creating') : t('create.submit')
                    })
                  ]
                })
              ]
            })
          ]
        })
      ]
    })
  })
}

// ── routines (cron) ──────────────────────────────────────────────────────────
//
// Jobs are namespaced "[bot:<name>] <routine>". A job running in the active
// bot profile uses the plain instruction; a different profile keeps the
// work4you -p <bot> chat delegation wrapper so the run reaches that bot's
// history. The tile follows the bot you're chatting with (gateway profile).
const BOT_TAG_RE = /^\[bot:([a-z0-9][a-z0-9_-]*)\]\s*/i
const SAFE_ROUTINE_MARKER = '[bot-mode:routine:v2] '
const LEGACY_DELEGATED_ROUTINE_PREFIX = 'You are running the scheduled routine "'

function routineBot(job) {
  const match = BOT_TAG_RE.exec(job?.name || '')
  return match ? match[1].toLowerCase() : null
}

function routineTitle(job, t = tr) {
  return (job?.name || '').replace(BOT_TAG_RE, '') || t('routines.untitled')
}

function isLegacyDelegatedRoutine(job) {
  const preview = typeof job?.prompt_preview === 'string' ? job.prompt_preview : job?.prompt
  return Boolean(routineBot(job) && typeof preview === 'string' && preview.startsWith(LEGACY_DELEGATED_ROUTINE_PREFIX))
}

async function loadRoutines(profile) {
  // profile scopes cron.manage to that bot's own cron store (core RPC gained an
  // optional `profile` param). Older gateways ignore the unknown param and
  // return the launch-profile store — the [bot:] tag filter in selectRoutineJobs
  // remains the graceful fallback there.
  const scope = profile ? { profile } : {}
  const data = await host.request('cron.manage', { action: 'list', include_disabled: true, ...scope })
  const jobs = Array.isArray(data?.jobs) ? data.jobs : []
  const activeLegacyJobs = jobs.filter(
    job => isLegacyDelegatedRoutine(job) && job.enabled !== false && job.state !== 'paused'
  )

  // A pause failing must not fail the LIST — the pane would report "could
  // not load cronjobs" over data that loaded fine, and the 20s poll would
  // re-attempt the failing pause inside a failing query forever. Each pause
  // swallows its own error; the overlay only claims jobs the gateway
  // actually paused, and the next poll retries the rest.
  const pauses = await Promise.all(
    activeLegacyJobs.map(job =>
      host
        .request('cron.manage', { action: 'pause', name: job.job_id, ...scope })
        .then(() => true)
        .catch(() => false)
    )
  )

  if (!activeLegacyJobs.length) {
    return data
  }

  const pausedIds = new Set(activeLegacyJobs.filter((job, index) => pauses[index]).map(job => job.job_id))
  return {
    ...data,
    jobs: jobs.map(job => (pausedIds.has(job.job_id) ? { ...job, enabled: false, state: 'paused' } : job))
  }
}

function useRoutines(profile) {
  return useQuery({
    queryKey: [...ROUTINES_KEY, profile || ''],
    queryFn: () => loadRoutines(profile),
    refetchInterval: 20000,
    staleTime: 8000
  })
}

function routineCreateTarget(owner, activeBot) {
  return owner || activeBot
}

async function invalidateRoutineOwner(profile) {
  await queryClient.invalidateQueries({
    queryKey: [...ROUTINES_KEY, profile || ''],
    exact: true
  })
}

/** Pick which cron jobs to show. A failed refresh keeps the last good list. */
function selectRoutineJobs(data, error, lastJobs, bot) {
  const live = Array.isArray(data?.jobs) ? data.jobs : null
  const all = live ?? (error ? lastJobs : [])
  const scopedToBot = normalizedProfileName(data?.scoped) === normalizedProfileName(bot)
  return {
    live,
    all,
    jobs: scopedToBot ? all : all.filter(job => (routineBot(job) || 'default') === bot)
  }
}

/**
 * Why the Routines pane can be empty while the bot's cron store has jobs.
 *
 * On older gateways the pane only shows jobs namespaced `[bot:<name>]` for the
 * active bot (plus untagged legacy jobs on the default bot). When jobs exist in
 * the store but none surface for this bot, the user is left staring at the
 * generic empty state with no hint that cronjobs are present but hidden.
 * Return a short explanation string in that case, or null when the store is
 * genuinely empty (or the active bot's jobs are already shown).
 */
function routineFilterHint(all, jobs, t = tr) {
  if (jobs.length !== 0 || !Array.isArray(all) || all.length === 0) {
    return null
  }
  return t('routines.filterHint')
}

function normalizedProfileName(profile) {
  return typeof profile === 'string' ? profile.trim().toLowerCase() : ''
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\"'\"'")}'`
}

/** Escape for interpolation INSIDE an existing double-quoted shell string:
 *  keeps ", `, $, and \ literal so free-text titles (which sync from ui_meta)
 *  and gateway profile names can't expand or break out of the quotes. */
function shellDoubleQuote(value) {
  return String(value).replace(/[\\"`$]/g, ch => '\\' + ch)
}

function routineInputError(title, instruction, t = tr) {
  if (String(title).includes('\0')) {
    return t('routines.nameNul')
  }

  if (String(instruction).includes('\0')) {
    return t('routines.instructionNul')
  }

  return null
}

function routinePrompt(bot, title, instruction, activeProfile) {
  if (normalizedProfileName(bot) && normalizedProfileName(bot) === normalizedProfileName(activeProfile)) {
    return instruction
  }

  return (
    `${SAFE_ROUTINE_MARKER}You are running the scheduled routine "${title}" for agent '${bot}'. ` +
    `Execute it AS that agent so the run lands in its own history: run this in the terminal and relay the output:\n\n` +
    `work4you -p ${shellQuote(bot)} chat -c ${shellQuote(`Routine: ${title}`)} -q ${shellQuote(`[Scheduled routine] ${instruction}`)}\n\n` +
    `If the command fails, report the error instead.`
  )
}
function scheduleLabel(schedule, t = tr) {
  const once = /^once in (.+)$/.exec(schedule || '')

  if (once) {
    return t('routines.schedule.once', once[1])
  }

  const bare = /^(\d+)([mhd])$/.exec(schedule || '')

  if (bare) {
    return t('routines.schedule.once', `${bare[1]}${bare[2]}`)
  }

  const match = /^every (\d+)m$/.exec(schedule || '')

  if (match) {
    const minutes = Number(match[1])

    if (minutes % 1440 === 0) {
      const d = minutes / 1440
      return d === 1 ? t('routines.schedule.daily') : t('routines.schedule.everyDays', d)
    }

    if (minutes % 60 === 0) {
      const h = minutes / 60
      return h === 1 ? t('routines.schedule.hourly') : t('routines.schedule.everyHours', h)
    }

    return t('routines.schedule.everyMinutes', minutes)
  }

  return schedule || ''
}

function RoutineRow({ job, profile }) {
  const t = useBotModeT()
  const [busy, setBusy] = useState(false)
  // Optimistic overlay: null = trust server state. Set immediately on
  // toggle so the switch responds even before the refetch lands.
  const [pendingActive, setPendingActive] = useState(null)
  const legacyUnsafe = isLegacyDelegatedRoutine(job)
  const serverActive = !legacyUnsafe && job.enabled !== false && job.state !== 'paused'
  const active = pendingActive === null ? serverActive : pendingActive

  if (pendingActive !== null && pendingActive === serverActive) {
    setPendingActive(null) // server caught up
  }

  const act = async action => {
    if (busy) {
      return
    }

    setBusy(true)

    if (action === 'pause' || action === 'resume') {
      setPendingActive(action === 'resume')
    }

    try {
      await host.request('cron.manage', { action, name: job.job_id, ...(profile ? { profile } : {}) })
      await invalidateRoutineOwner(profile)
    } catch (err) {
      setPendingActive(null)
      host.notifyError(err, t('routines.updateFailed'))
    } finally {
      setBusy(false)
    }
  }

  return jsxs('div', {
    className: cn(
      'group grid gap-1.5 rounded-lg border border-(--ui-stroke-secondary) p-2.5 transition-colors',
      'hover:border-(--ui-stroke-primary, var(--ui-stroke-secondary))'
    ),
    children: [
      jsxs('div', {
        className: 'flex items-center gap-2',
        children: [
          jsx('span', {
            'aria-hidden': true,
            className: cn('size-1.5 shrink-0 rounded-full', active ? 'bg-emerald-500' : 'bg-(--ui-text-quaternary)')
          }),
          jsx('span', {
            className: cn('min-w-0 flex-1 truncate text-xs font-medium', !active && 'text-(--ui-text-tertiary)'),
            children: routineTitle(job, t)
          }),
          jsx(Switch, {
            checked: active,
            disabled: busy || legacyUnsafe,
            onCheckedChange: value => act(value ? 'resume' : 'pause')
          }),
          jsx(Tip, {
            label: t('routines.delete'),
            children: jsx('button', {
              type: 'button',
              disabled: busy,
              className:
                'flex size-5 items-center justify-center rounded text-(--ui-text-quaternary) opacity-0 transition-opacity group-hover:opacity-100 hover:bg-(--chrome-action-hover) hover:text-foreground',
              onClick: () => act('remove'),
              children: jsx(Codicon, { name: 'trash', className: 'text-[0.75rem]' })
            })
          })
        ]
      }),
      jsxs('div', {
        className: 'flex items-center justify-between gap-2 pl-3.5',
        children: [
          jsxs('span', {
            className:
              'inline-flex items-center gap-1 rounded-full border border-(--ui-stroke-secondary) px-1.5 py-0.5 text-[0.65rem] text-(--ui-text-tertiary)',
            children: [jsx(Codicon, { name: 'calendar', className: 'text-[0.7rem]' }), scheduleLabel(job.schedule, t)]
          }),
          jsx('span', {
            className: 'truncate text-[0.65rem] text-(--ui-text-quaternary)',
            children:
              active && job.next_run_at
                ? t('routines.next', relativeTime(new Date(job.next_run_at).getTime()))
                : t('routines.paused')
          })
        ]
      }),
      legacyUnsafe
        ? jsx('div', {
            className:
              'rounded-md border border-(--ui-stroke-secondary) px-2 py-1.5 text-[0.65rem] leading-4 text-(--ui-accent)',
            children: t('routines.legacyPaused')
          })
        : null
    ]
  })
}

// Structured schedule picker: frequency first, then only the detail that
// frequency needs (time of day, weekday, day of month, interval). Emits a
// Work4You-native schedule string; Advanced exposes it raw. Option ids are
// schedule state; their labels resolve through the translator at render
// (routines.frequency / routines.weekdays / routines.timeOfDay).
const FREQUENCIES = ['once', 'hourly', 'daily', 'weekdays', 'weekly', 'monthly', 'interval', 'advanced']

const WEEKDAYS = [
  { id: '1', key: 'monday' },
  { id: '2', key: 'tuesday' },
  { id: '3', key: 'wednesday' },
  { id: '4', key: 'thursday' },
  { id: '5', key: 'friday' },
  { id: '6', key: 'saturday' },
  { id: '0', key: 'sunday' }
]

const TIMES = (() => {
  const out = []
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      out.push({ id: `${h}:${m}`, h, m })
    }
  }
  return out
})()

/** Localized label for a WEEKDAYS id (falls back to Monday, like the summary). */
function weekdayLabel(id, t = tr) {
  return t(`routines.weekdays.${(WEEKDAYS.find(day => day.id === id) || WEEKDAYS[0]).key}`)
}

/** Compose the Work4You schedule string from picker state. */
function composeSchedule(state) {
  const [h, m] = (state.time || '9:0').split(':').map(Number)

  switch (state.freq) {
    case 'once': {
      const n = Math.max(1, parseInt(state.onceN, 10) || 1)
      return `${n}${state.onceUnit || 'h'}`
    }
    case 'hourly':
      return 'every 1h'
    case 'daily':
      return `${m} ${h} * * *`
    case 'weekdays':
      return `${m} ${h} * * 1-5`
    case 'weekly':
      return `${m} ${h} * * ${state.weekday || '1'}`
    case 'monthly':
      return `${m} ${h} ${state.monthday || '1'} * *`
    case 'interval': {
      const n = Math.max(1, parseInt(state.intervalN, 10) || 1)
      return `every ${n}${state.intervalUnit || 'h'}`
    }
    default:
      return state.raw || ''
  }
}

function scheduleSummary(state, t = tr) {
  const time = TIMES.find(x => x.id === state.time)
  const tl = time ? t('routines.timeOfDay', time.h, time.m) : t('routines.timeOfDay', 9, 0)

  const cap =
    state.freq !== 'once' && String(state.repeatN || '').trim()
      ? t('routines.summary.cap', Math.max(1, parseInt(state.repeatN, 10) || 1))
      : ''

  switch (state.freq) {
    case 'once':
      return t('routines.summary.once', Math.max(1, parseInt(state.onceN, 10) || 1), state.onceUnit)
    case 'hourly':
      return t('routines.summary.hourly') + cap
    case 'daily':
      return t('routines.summary.daily', tl) + cap
    case 'weekdays':
      return t('routines.summary.weekdays', tl) + cap
    case 'weekly':
      return t('routines.summary.weekly', weekdayLabel(state.weekday, t), tl) + cap
    case 'monthly':
      return t('routines.summary.monthly', state.monthday || '1', tl) + cap
    case 'interval':
      return t('routines.summary.interval', Math.max(1, parseInt(state.intervalN, 10) || 1), state.intervalUnit) + cap
    default:
      return t('routines.summary.raw')
  }
}

// Kept in the plugin so the creation surface also works when the plugin is
// loaded dynamically. Every selector is scoped to this dialog.
const ROUTINE_CREATE_CSS = `
[data-slot='dialog-content'][data-workbots-routine-create] {
  width: min(32.5rem, calc(100vw - 2rem));
  max-width: none;
  max-height: calc(100dvh - 2rem);
  border-radius: var(--card-radius);
  background: var(--ui-bg-elevated);
  color: var(--ui-text-primary);
  font-size: 0.875rem;
}
[data-workbots-routine-create] .workbots-routine-body,
[data-workbots-routine-create] .workbots-routine-form {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 0;
  gap: 0;
  overflow: hidden;
}
[data-workbots-routine-create] .workbots-routine-header {
  padding: 1.25rem 2.75rem 0.875rem 1.25rem;
  flex-shrink: 0;
  text-align: start;
}
[data-workbots-routine-create] [data-slot='dialog-title'] {
  font-size: 1.25rem;
  line-height: 1.4;
}
[data-workbots-routine-create] .workbots-routine-scroll {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}
[data-workbots-routine-create] .workbots-routine-fields {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 0;
  margin: 0;
  border: 0;
  padding: 0 1.25rem 1.25rem;
}
[data-workbots-routine-create] .workbots-routine-owner {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}
[data-workbots-routine-create] .workbots-routine-owner-text { min-width: 0; }
[data-workbots-routine-create] .workbots-routine-owner-name {
  display: block;
  overflow-wrap: anywhere;
  font-size: 0.9375rem;
  font-weight: 600;
}
[data-workbots-routine-create] .workbots-routine-instructions {
  min-height: 5rem;
  resize: vertical;
}
[data-workbots-routine-create] .workbots-routine-schedule,
[data-workbots-routine-create] .workbots-routine-execution {
  display: grid;
  gap: 0.625rem;
  border-top: 1px solid var(--ui-stroke-tertiary);
  padding-top: 0.875rem;
}
[data-workbots-routine-create] .workbots-routine-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
  align-items: center;
  gap: 0.75rem;
  min-height: 2.25rem;
}
[data-workbots-routine-create] .workbots-routine-label {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  min-width: 0;
}
[data-workbots-routine-create] .workbots-routine-label .codicon { flex-shrink: 0; }
[data-workbots-routine-create] .workbots-routine-pair {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}
[data-workbots-routine-create] .workbots-routine-number { flex: 0 0 4rem; width: 4rem; }
[data-workbots-routine-create] .workbots-routine-continuity {
  grid-template-columns: minmax(0, 1fr) auto;
}
[data-workbots-routine-create] .workbots-routine-hint {
  color: var(--ui-text-secondary);
  font-size: 0.75rem;
  line-height: 1.5;
}
[data-workbots-routine-create] .workbots-routine-continuity .workbots-routine-hint {
  margin: 0.25rem 0 0;
  margin-inline-start: 1.625rem;
}
[data-workbots-routine-create] .workbots-routine-footer {
  display: flex;
  flex-direction: row;
  flex-shrink: 0;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border-top: 1px solid var(--ui-stroke-tertiary);
  padding: 0.875rem 1.25rem;
}
[data-workbots-routine-create] .workbots-routine-summary {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1 1 10rem;
  min-width: 0;
}
[data-workbots-routine-create] .workbots-routine-summary .codicon { flex-shrink: 0; }
[data-workbots-routine-create] .workbots-routine-actions {
  display: flex;
  gap: 0.5rem;
  margin-inline-start: auto;
}
@media (max-width: 420px) {
  [data-workbots-routine-create] .workbots-routine-row { grid-template-columns: minmax(0, 1fr); gap: 0.375rem; }
  [data-workbots-routine-create] .workbots-routine-continuity { grid-template-columns: minmax(0, 1fr) auto; }
}
`

function pickerSelect(value, onChange, options, id, disabled) {
  return jsxs(Select, {
    value,
    onValueChange: onChange,
    disabled,
    children: [
      jsx(SelectTrigger, { id, size: 'lg', children: jsx(SelectValue, {}) }),
      jsx(SelectContent, {
        children: options.map(o => jsx(SelectItem, { value: o.id, children: o.label }, o.id))
      })
    ]
  })
}

function routineSettingRow(label, icon, id, control) {
  return jsxs('div', {
    className: 'workbots-routine-row',
    children: [
      jsxs('label', {
        htmlFor: id,
        className: 'workbots-routine-label',
        children: [jsx(Codicon, { name: icon, size: 16, 'aria-hidden': true }), label]
      }),
      control
    ]
  })
}

function SchedulePicker({ state, setState, id, disabled }) {
  const t = useBotModeT()
  const upd = patch => setState(prev => ({ ...prev, ...patch }))
  const needsTime = ['daily', 'weekdays', 'weekly', 'monthly'].includes(state.freq)
  const select = (key, value, onChange, options) => pickerSelect(value, onChange, options, `${id}-${key}`, disabled)
  const duration = (kind, label) =>
    routineSettingRow(
      label,
      'watch',
      `${id}-${kind}-amount`,
      jsxs('div', {
        className: 'workbots-routine-pair',
        children: [
          jsx(Input, {
            id: `${id}-${kind}-amount`,
            size: 'lg',
            className: 'workbots-routine-number',
            inputMode: 'numeric',
            'aria-label': `${label}: ${t('routines.amount')}`,
            value: state[`${kind}N`],
            onChange: event => upd({ [`${kind}N`]: event.target.value.replace(/[^0-9]/g, '').slice(0, 4) })
          }),
          jsx('span', { id: `${id}-${kind}-unit-label`, className: 'sr-only', children: t('routines.unit') }),
          jsxs(Select, {
            value: state[`${kind}Unit`],
            onValueChange: value => upd({ [`${kind}Unit`]: value }),
            disabled,
            children: [
              jsx(SelectTrigger, {
                size: 'lg',
                'aria-labelledby': `${id}-${kind}-unit-label`,
                children: jsx(SelectValue, {})
              }),
              jsx(SelectContent, {
                children: ['m', 'h', 'd'].map((unit, index) =>
                  jsx(
                    SelectItem,
                    {
                      value: unit,
                      children: t(`routines.units.${['minutes', 'hours', 'days'][index]}`)
                    },
                    unit
                  )
                )
              })
            ]
          })
        ]
      })
    )

  return jsxs('div', {
    className: 'workbots-routine-schedule',
    children: [
      routineSettingRow(
        t('routines.repeat'),
        'sync',
        `${id}-frequency`,
        select(
          'frequency',
          state.freq,
          value => upd({ freq: value }),
          FREQUENCIES.map(freq => ({ id: freq, label: t(`routines.frequency.${freq}`) }))
        )
      ),
      needsTime
        ? routineSettingRow(
            t('routines.time'),
            'history',
            `${id}-time`,
            select(
              'time',
              state.time,
              value => upd({ time: value }),
              TIMES.map(time => ({ id: time.id, label: t('routines.timeOfDay', time.h, time.m) }))
            )
          )
        : null,
      state.freq === 'weekly'
        ? routineSettingRow(
            t('routines.weekday'),
            'calendar',
            `${id}-weekday`,
            select(
              'weekday',
              state.weekday,
              value => upd({ weekday: value }),
              WEEKDAYS.map(day => ({ id: day.id, label: t(`routines.weekdays.${day.key}`) }))
            )
          )
        : null,
      state.freq === 'monthly'
        ? routineSettingRow(
            t('routines.dayOfMonth'),
            'calendar',
            `${id}-monthday`,
            jsx(Input, {
              id: `${id}-monthday`,
              size: 'lg',
              inputMode: 'numeric',
              placeholder: '1',
              value: state.monthday,
              onChange: event => upd({ monthday: event.target.value.replace(/[^0-9]/g, '').slice(0, 2) })
            })
          )
        : null,
      state.freq === 'once' ? duration('once', t('routines.delay')) : null,
      state.freq === 'interval' ? duration('interval', t('routines.interval')) : null,
      state.freq === 'advanced'
        ? jsxs('div', {
            children: [
              labeled(
                t('routines.customSchedule'),
                jsx(Input, {
                  id: `${id}-raw`,
                  size: 'lg',
                  className: 'font-mono',
                  'aria-describedby': `${id}-raw-hint`,
                  placeholder: '0 9 * * *',
                  value: state.raw,
                  onChange: event => upd({ raw: event.target.value })
                })
              ),
              jsx('p', {
                id: `${id}-raw-hint`,
                className: 'workbots-routine-hint',
                children: t('routines.customScheduleHint')
              })
            ]
          })
        : null
    ]
  })
}

function defaultScheduleState() {
  return {
    freq: 'daily',
    time: '9:0',
    weekday: '1',
    monthday: '1',
    intervalN: '2',
    intervalUnit: 'h',
    onceN: '30',
    onceUnit: 'm',
    repeatN: '',
    raw: ''
  }
}

function CreateRoutineDialog({ bot, open, onClose }) {
  const t = useBotModeT()
  const id = useId()
  const meta = useValue($botMeta)[bot]
  const appearance = botAppearance(bot, meta)
  const [name, setName] = useState('')
  const [instruction, setInstruction] = useState('')
  const [sched, setSched] = useState(defaultScheduleState())
  const [limited, setLimited] = useState(false)
  const [continuity, setContinuity] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const activeProfile = useValue(host.state.profile)
  const schedule = composeSchedule(sched)

  const reset = () => {
    setName('')
    setInstruction('')
    setSched(defaultScheduleState())
    setLimited(false)
    setContinuity(false)
    setBusy(false)
    setError(null)
  }

  const submit = async () => {
    const title = name.trim()
    const task = instruction.trim()
    const inputError = routineInputError(title, task)

    if (inputError) {
      setError(inputError)
      return
    }

    if (!title || !task || !schedule.trim() || busy) {
      return
    }

    setBusy(true)
    setError(null)

    try {
      const repeatN =
        sched.freq !== 'once' && sched.freq !== 'advanced' && String(sched.repeatN || '').trim()
          ? Math.max(1, parseInt(sched.repeatN, 10) || 1)
          : null
      await host.request('cron.manage', {
        action: 'add',
        name: `[bot:${bot}] ${title}`,
        schedule: schedule.trim(),
        prompt: routinePrompt(bot, title, task, activeProfile),
        ...(bot ? { profile: bot } : {}),
        ...(repeatN ? { repeat: repeatN } : {}),
        ...(continuity ? { continuity: true } : {})
      })
      await invalidateRoutineOwner(bot)
      host.notify({ kind: 'success', message: t('routines.scheduled', title) })
      reset()
      onClose()
    } catch (err) {
      setBusy(false)
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return jsx(Dialog, {
    open,
    onOpenChange: value => {
      if (!value && !busy) {
        reset()
        onClose()
      }
    },
    children: jsxs(DialogContent, {
      'data-workbots-routine-create': '',
      bodyClassName: 'workbots-routine-body',
      children: [
        jsx('style', { children: ROUTINE_CREATE_CSS }),
        jsx(DialogHeader, {
          className: 'workbots-routine-header',
          children: jsx(DialogTitle, { children: t('routines.newTitle') })
        }),
        jsxs('form', {
          className: 'workbots-routine-form',
          onSubmit: event => {
            event.preventDefault()
            void submit()
          },
          children: [
            jsx('div', {
              className: 'workbots-routine-scroll',
              children: jsxs('fieldset', {
                disabled: busy,
                className: 'workbots-routine-fields',
                children: [
                  jsxs('div', {
                    className: 'workbots-routine-owner',
                    children: [
                      jsx(BotFace, { ...appearance, size: 44, name: bot }),
                      jsxs('div', {
                        className: 'workbots-routine-owner-text',
                        children: [
                          jsx('span', {
                            className: 'workbots-routine-owner-name',
                            children: displayName({ name: bot }, meta)
                          }),
                          jsx(DialogDescription, {
                            className: 'workbots-routine-hint',
                            children: t('routines.newSubtitle')
                          })
                        ]
                      })
                    ]
                  }),
                  labeled(
                    t('common.name'),
                    jsx(Input, {
                      id: `${id}-name`,
                      autoFocus: true,
                      required: true,
                      size: 'lg',
                      placeholder: t('routines.namePlaceholder'),
                      value: name,
                      onChange: event => setName(event.target.value)
                    })
                  ),
                  labeled(
                    t('routines.instruction'),
                    jsx(Textarea, {
                      id: `${id}-instructions`,
                      required: true,
                      size: 'lg',
                      className: 'workbots-routine-instructions',
                      placeholder: t('routines.instructionPlaceholder'),
                      value: instruction,
                      onChange: event => setInstruction(event.target.value)
                    })
                  ),
                  jsx(SchedulePicker, { state: sched, setState: setSched, id, disabled: busy }),
                  jsxs('div', {
                    className: 'workbots-routine-execution',
                    children: [
                      sched.freq !== 'once' && sched.freq !== 'advanced'
                        ? routineSettingRow(
                            t('routines.runLimit'),
                            'play-circle',
                            `${id}-limit`,
                            jsxs('div', {
                              className: 'workbots-routine-pair',
                              children: [
                                pickerSelect(
                                  limited ? 'limited' : 'unlimited',
                                  value => {
                                    setLimited(value === 'limited')
                                    setSched(prev => ({ ...prev, repeatN: value === 'unlimited' ? '' : '1' }))
                                  },
                                  [
                                    { id: 'unlimited', label: t('routines.unlimited') },
                                    { id: 'limited', label: t('routines.limited') }
                                  ],
                                  `${id}-limit`,
                                  busy
                                ),
                                limited
                                  ? jsx(Input, {
                                      size: 'lg',
                                      className: 'workbots-routine-number',
                                      inputMode: 'numeric',
                                      required: true,
                                      'aria-label': t('routines.runCount'),
                                      value: sched.repeatN,
                                      onChange: event =>
                                        setSched(prev => ({
                                          ...prev,
                                          repeatN: event.target.value.replace(/[^0-9]/g, '').slice(0, 4)
                                        })),
                                      onBlur: () => setSched(prev => ({ ...prev, repeatN: prev.repeatN || '1' }))
                                    })
                                  : null
                              ]
                            })
                          )
                        : null,
                      jsxs('div', {
                        className: 'workbots-routine-row workbots-routine-continuity',
                        children: [
                          jsxs('div', {
                            children: [
                              jsxs('label', {
                                className: 'workbots-routine-label',
                                htmlFor: `${id}-continuity`,
                                children: [
                                  jsx(Codicon, { name: 'database', size: 16, 'aria-hidden': true }),
                                  t('routines.continuity')
                                ]
                              }),
                              jsx('p', {
                                id: `${id}-continuity-hint`,
                                className: 'workbots-routine-hint',
                                children: t('routines.continuityHint')
                              })
                            ]
                          }),
                          jsx(Switch, {
                            id: `${id}-continuity`,
                            size: 'xs',
                            'aria-label': t('routines.continuity'),
                            'aria-describedby': `${id}-continuity-hint`,
                            checked: continuity,
                            disabled: busy,
                            onCheckedChange: setContinuity
                          })
                        ]
                      })
                    ]
                  }),
                  error
                    ? jsx('div', {
                        role: 'alert',
                        className: 'text-xs text-destructive',
                        children: error
                      })
                    : null
                ]
              })
            }),
            jsxs(DialogFooter, {
              className: 'workbots-routine-footer',
              children: [
                jsxs('div', {
                  className: 'workbots-routine-summary workbots-routine-hint',
                  role: 'status',
                  children: [
                    jsx(Codicon, { name: 'history', size: 16, 'aria-hidden': true }),
                    jsx('span', { children: scheduleSummary(sched, t) })
                  ]
                }),
                jsxs('div', {
                  className: 'workbots-routine-actions',
                  children: [
                    jsx(Button, {
                      type: 'button',
                      variant: 'ghost',
                      disabled: busy,
                      onClick: () => {
                        reset()
                        onClose()
                      },
                      children: t('common.cancel')
                    }),
                    jsx(Button, {
                      type: 'submit',
                      disabled: busy || !name.trim() || !instruction.trim() || !schedule.trim(),
                      children: busy ? t('routines.scheduling') : t('routines.create')
                    })
                  ]
                })
              ]
            })
          ]
        })
      ]
    })
  })
}

/** Keeps $selectedBot in sync with the focused chat's owner profile.
 *  nanostores' `.listen()` never replays the current value the way
 *  `.subscribe()` does, so a disable → profile switch → re-enable sequence
 *  would otherwise leave $selectedBot pointed at whichever bot was active
 *  before the plugin was disabled — reseeding here on every register() call
 *  closes that gap. Returns the unbind function for ctx.onDispose. */
function bindProfileSync(profileStore) {
  const current = profileStore.get?.()
  if (current && typeof current === 'string') {
    $selectedBot.set(current)
  }
  return profileStore.listen(profile => {
    if (profile && typeof profile === 'string') {
      $selectedBot.set(profile)
    }
  })
}

function RoutinesPane() {
  const t = useBotModeT()
  const selected = useValue($selectedBot)
  const focusedProfile = useValue($focusedBotProfile)
  // The tile maps to the bot you're chatting with: the focused chat's owner
  // profile is the truth once a chat opens (on older desktops without the
  // focused-owner atom this is the live gateway profile, the previous
  // behavior); $selectedBot covers the gap between a roster click and the
  // focus/profile swap landing.
  const bot = (focusedProfile || selected || 'default').trim() || 'default'
  const meta = useValue($botMeta)[bot]
  const { shape, color, image } = botAppearance(bot, meta)
  const { data, error, isLoading, refetch } = useRoutines(bot)
  const [createOpen, setCreateOpen] = useState(false)
  const [createOwner, setCreateOwner] = useState(null)
  const createTarget = routineCreateTarget(createOwner, bot)

  const openCreate = () => {
    setCreateOwner(bot)
    setCreateOpen(true)
  }

  const view = selectRoutineJobs(data, error, $lastJobs.get(), bot)
  if (view.live) {
    $lastJobs.set(view.live)
  }
  const jobs = view.jobs
  const staleNotice = error && !view.live && view.all.length ? t('routines.staleNotice') : null
  const filterHint = routineFilterHint(view.all, jobs, t)

  return jsxs('div', {
    className: 'flex h-full flex-col',
    children: [
      jsxs('div', {
        className: 'flex items-center gap-2 px-3 pt-3 pb-2',
        children: [
          jsx(BotFace, { shape, color, image, size: 22, name: bot }),
          jsxs('div', {
            className: 'min-w-0 flex-1',
            children: [
              jsxs('div', {
                className: 'flex min-w-0 items-baseline gap-1.5 truncate',
                children: [
                  jsx('div', {
                    className: 'truncate text-xs font-semibold',
                    children: displayName({ name: bot }, meta)
                  }),
                  showsHandle(bot, meta)
                    ? jsx('span', {
                        className: 'shrink-0 font-mono text-[0.65rem] text-(--ui-text-quaternary)',
                        children: `@${botHandle(bot)}`
                      })
                    : null
                ]
              }),
              jsx('div', {
                className: 'text-[0.65rem] uppercase tracking-wider text-(--ui-text-quaternary)',
                children: t('routines.paneTitle')
              })
            ]
          }),
          jsx(Tip, {
            label: t('routines.newTitle'),
            children: jsx('button', {
              type: 'button',
              className:
                'flex size-6 shrink-0 items-center justify-center rounded-md text-(--ui-text-tertiary) transition-colors hover:bg-(--chrome-action-hover) hover:text-foreground',
              onClick: openCreate,
              children: jsx(Codicon, { name: 'add' })
            })
          })
        ]
      }),
      jsx('div', { className: 'mx-3 border-t border-(--ui-stroke-secondary)' }),
      staleNotice
        ? jsx('div', {
            className: 'mx-3 mt-2 rounded-md bg-(--chrome-action-hover) px-2 py-1.5 text-[0.6875rem] text-(--ui-text-tertiary)',
            children: staleNotice
          })
        : null,
      isLoading && !view.all.length
        ? jsx('div', {
            className: 'flex flex-1 items-center justify-center',
            children: jsx(GlyphSpinner, { spinner: 'breathe', className: 'text-(--ui-text-tertiary)' })
          })
        : error && !view.all.length
          ? jsxs('div', {
              className: 'flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center',
              children: [
                jsx(Codicon, { name: 'warning', className: 'text-[1.6rem] text-(--ui-text-quaternary)' }),
                jsx('div', {
                  className: 'text-xs leading-5 text-(--ui-text-tertiary)',
                  children: t('routines.loadFailed')
                }),
                jsx(Button, {
                  variant: 'secondary',
                  size: 'sm',
                  onClick: () => void refetch(),
                  children: t('common.retry')
                })
              ]
            })
        : jobs.length === 0
          ? jsxs('div', {
              className: 'flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center',
              children: [
                // No generic placeholder here: an icon + "cronjobs are…" blurb and the
                // create button both just said "empty" (Teknium, Aug 2026). The hint
                // text stays only when jobs exist but are hidden by the bot filter —
                // that carries real information, not an empty-state marker.
                filterHint
                  ? jsx('div', {
                      className: 'text-xs leading-5 text-(--ui-text-tertiary)',
                      children: filterHint
                    })
                  : null,
                jsx(Button, {
                  variant: 'secondary',
                  size: 'sm',
                  onClick: openCreate,
                  children: filterHint ? t('routines.createForBot') : t('routines.create')
                })
              ]
            })
          : jsx(ScrollArea, {
              className: 'min-h-0 flex-1',
              children: jsx('div', {
                className: 'grid gap-1.5 px-2.5 py-2',
                children: jobs.map(job => jsx(RoutineRow, { job, profile: bot }, job.job_id))
              })
            }),
      jsx(CreateRoutineDialog, {
        bot: createTarget,
        open: createOpen,
        onClose: () => {
          setCreateOpen(false)
          setCreateOwner(null)
        }
        // key is the jsx() THIRD argument — as a prop it is silently ignored
        // and the dialog kept stale per-bot form state when the target changed.
      }, createTarget)
    ]
  })
}

/** Live tab label for the Cronjobs pane: the registered `title` is read once
 *  (at boot, before the display language may have loaded), this one follows
 *  every language switch. */
function RoutinesPaneTitle() {
  const t = useBotModeT()

  return t('routines.paneTitle')
}

// ── profile session workspace ────────────────────────────────────────────────

const PROFILE_SESSION_LIST_LIMIT = 200

function openBotSessionsWorkspace(bot) {
  if (bot?.name && NAME_RE.test(bot.name)) {
    $botSessionsWorkspace.set(bot.name)
  }
}

function filterProfileSessions(sessions, query) {
  const needle = String(query || '').trim().toLowerCase()
  const rows = Array.isArray(sessions) ? sessions : []
  if (!needle) return rows
  return rows.filter(session =>
    `${session?.title || ''} ${session?.preview || ''} ${session?.source || ''}`.toLowerCase().includes(needle)
  )
}

function useProfileSessions(botName, gatewayGeneration) {
  return useQuery({
    queryKey: [ID, 'profile-sessions', botName, gatewayGeneration],
    enabled: Boolean(botName),
    // include_hidden: this browser exists precisely to see the profile's own
    // (always-hidden) Bot Mode sessions alongside its regular ones.
    queryFn: () => host.request('session.list', { profile: botName, limit: PROFILE_SESSION_LIST_LIMIT, include_hidden: true }),
    refetchInterval: 8000,
    staleTime: 4000,
    retry: false
  })
}

async function openProfileSession(botName, session, gatewayGeneration) {
  const profile = String(botName || '')
  const id = String(session?.id || '')
  if (!NAME_RE.test(profile) || !id || gatewayGeneration !== $sessionsGatewayGeneration.get()) return
  if (typeof host.openSession !== 'function') {
    throw new Error(tr('sessions.cannotOpenStored'))
  }

  // Same hydration contract as canonical Bot Chats (#89206): a bare open can
  // focus a main surface whose runtime/transcript silently vanished, leaving a
  // blank pane while the row preview still shows the conversation. Waiting on
  // hydration lets the SDK issue the explicit resume when the surface is stale.
  const hasAuthoritativeCount =
    typeof session?.message_count === 'number' && Number.isFinite(session.message_count)
  const expectHistory = hasAuthoritativeCount ? session.message_count > 0 : Boolean(session?.preview)

  await host.openSession(id, { profile, awaitHydration: true, expectHistory, keepAllProfilesScope: true })
  if (gatewayGeneration !== $sessionsGatewayGeneration.get()) return
  $botSelectedSessions.set({ ...$botSelectedSessions.get(), [profile]: id })
}

function ProfileSessionRow({ session, botName, active, gatewayGeneration }) {
  const t = useBotModeT()

  return jsxs('button', {
    type: 'button',
    'aria-current': active ? 'page' : undefined,
    onClick: () =>
      void openProfileSession(botName, session, gatewayGeneration).catch(err =>
        host.notifyError(err, t('sessions.openFailed'))
      ),
    className: cn(
      'flex w-full flex-col gap-0.5 overflow-hidden rounded-md px-2 py-1.5 text-left transition-colors',
      'hover:bg-(--chrome-action-hover)',
      active && 'bg-(--ui-row-active-background)'
    ),
    children: [
      jsx('span', {
        className: 'truncate text-[0.8125rem] font-medium',
        children: session.title || t('sessions.untitled')
      }),
      jsx('div', {
        className: 'truncate text-[0.7rem] text-(--ui-text-tertiary)',
        children: session.preview || session.source || t('sessions.noMessages')
      })
    ]
  })
}

function ProfileSessionsWorkspace({ bot }) {
  const t = useBotModeT()
  const gatewayGeneration = useValue($sessionsGatewayGeneration)
  const { data, isLoading, error } = useProfileSessions(bot.name, gatewayGeneration)
  const selectedByProfile = useValue($botSelectedSessions)
  const [query, setQuery] = useState('')
  const sourceSessions = data?.sessions || []
  const sessions = filterProfileSessions(sourceSessions, query)
  const inventoryBounded = sourceSessions.length >= PROFILE_SESSION_LIST_LIMIT
  const selectedId = selectedByProfile[bot.name] || ''

  const header = jsxs('div', {
    className: 'flex items-center gap-2 px-2.5 pt-2.5 pb-2',
    children: [
      jsx(Button, {
        variant: 'ghost',
        size: 'sm',
        onClick: () => $botSessionsWorkspace.set(null),
        children: t('common.back')
      }),
      jsx('div', {
        className: 'min-w-0 flex-1 truncate text-sm font-semibold',
        children: t('sessions.title', displayName(bot, $botMeta.get()[bot.name]))
      })
    ]
  })

  return jsxs('div', {
    className: 'flex h-full flex-col',
    children: [
      header,
      jsx('div', {
        className: 'px-2 pb-2',
        children: jsx(Input, {
          'aria-label': t('sessions.filterLabel'),
          placeholder: t('sessions.filterPlaceholder'),
          value: query,
          onChange: event => setQuery(event.target.value)
        })
      }),
      inventoryBounded
        ? jsx('div', {
            className: 'px-2.5 pb-2 text-[0.65rem] text-(--ui-text-quaternary)',
            children: t('sessions.showingRecent', PROFILE_SESSION_LIST_LIMIT)
          })
        : null,
      isLoading
        ? jsx('div', {
            className: 'flex flex-1 items-center justify-center',
            children: jsx(GlyphSpinner, { spinner: 'breathe' })
          })
        : error
          ? jsx('div', {
              className: 'px-3 py-3 text-xs text-(--ui-text-tertiary)',
              children: t('sessions.loadFailed')
            })
          : jsx(ScrollArea, {
              className: 'min-h-0 flex-1',
              children: jsx('div', {
                className: 'grid gap-0.5 px-1.5 pb-2',
                children: sessions.length
                  ? sessions.map(session => jsx(ProfileSessionRow, {
                      session,
                      botName: bot.name,
                      active: selectedId === session.id,
                      gatewayGeneration
                    }, session.id))
                  : jsx('div', {
                      className: 'px-2 py-3 text-center text-xs text-(--ui-text-tertiary)',
                      children: query.trim()
                        ? inventoryBounded
                          ? t('sessions.noMatchRecent', PROFILE_SESSION_LIST_LIMIT)
                          : t('sessions.noMatch')
                        : t('sessions.empty')
                    })
              })
            })
    ]
  })
}

// ── roster pane ──────────────────────────────────────────────────────────────

/** "Active now" presence strip above the roster: chips for every bot that is
 *  working right now (the gateway-busy selected profile + bots whose last
 *  message landed inside the liveness window). Reuses the row avatar; each
 *  chip opens that bot's canonical Bot Chat. Omitted entirely when nothing
 *  is active, and never reorders the roster below it. */
function ActiveNowStrip({ roster, activeProfile, gatewayState, metaByName, onOpen }) {
  const t = useBotModeT()
  const active = activeBots(roster, activeProfile, gatewayState)

  if (!active.length) {
    return null
  }

  return jsxs('div', {
    role: 'status',
    'aria-live': 'polite',
    'aria-label': t('roster.activeNow'),
    className: 'flex flex-wrap items-center gap-1.5 px-2.5 pb-1.5',
    children: [
      jsx('span', {
        className: 'text-[0.6875rem] font-semibold uppercase tracking-wider text-(--ui-text-quaternary)',
        children: t('roster.activeNow')
      }),
      ...active.map(bot => {
        const meta = metaByName?.[bot.name]
        const { shape, color, image } = botAppearance(bot.name, meta)
        const photo = Boolean(image && !isBackfilledFacePng(image))
        const label = displayName(bot, meta)

        return jsx('button', {
          type: 'button',
          title: t('roster.openChat', label),
          className: cn(
            'flex items-center gap-1.5 rounded-md bg-(--chrome-action-hover) px-1.5 py-1 text-left transition-colors',
            'hover:bg-(--chrome-action-hover) hover:text-foreground'
          ),
          onClick: () => onOpen(bot),
          children: [
            jsx(BotFace, {
              shape,
              color,
              image: photo ? image : null,
              size: 24,
              name: bot.name,
              mood: 'work'
            }),
            jsx('span', {
              className: 'max-w-28 truncate text-xs font-medium',
              children: label
            })
          ]
        }, botRosterKey(bot))
      })
    ]
  })
}

/** Assign a bot to a group-chat membership without replacing its others.
 *  Existing groups are independent toggles; the input creates and joins a new
 *  one. Canonical groups + the legacy scalar projection ride ui_meta. */
function GroupDialog({ bot, onClose }) {
  const t = useBotModeT()
  const meta = useValue($botMeta)
  const [name, setName] = useState('')
  const current = botGroups(meta[bot?.name])
  const groups = knownGroups(meta)

  const setMembership = (group, enabled) => {
    saveBotMeta(bot.name, groupMembershipPatch(meta[bot.name], group, enabled))
    host.notify({
      kind: 'info',
      message: enabled
        ? t('groups.added', displayName(bot, meta[bot.name]), group)
        : t('groups.removed', displayName(bot, meta[bot.name]), group)
    })
  }

  return jsx(Dialog, {
    open: Boolean(bot),
    onOpenChange: value => {
      if (!value) {
        onClose()
      }
    },
    children: jsxs(DialogContent, {
      className: 'max-w-sm',
      children: [
        jsxs(DialogHeader, {
          children: [
            jsx(DialogTitle, { children: t('groups.manageTitle') }),
            jsx(DialogDescription, {
              children: t('groups.manageSubtitle')
            })
          ]
        }),
        groups.length
          ? jsx('div', {
              className: 'grid gap-1.5',
              children: groups.map(group => {
                const enabled = current.includes(group)

                return jsxs(
                  'label',
                  {
                    className:
                      'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-(--chrome-action-hover)',
                    children: [
                      jsx(Checkbox, {
                        checked: enabled,
                        onCheckedChange: checked => setMembership(group, checked === true)
                      }),
                      jsx('span', { children: group })
                    ]
                  },
                  group
                )
              })
            })
          : null,
        jsxs('form', {
          className: 'flex items-center gap-1.5',
          onSubmit: event => {
            event.preventDefault()
            const trimmed = name.trim()

            if (trimmed) {
              setMembership(trimmed, true)
              setName('')
            }
          },
          children: [
            jsx(Input, {
              autoFocus: true,
              placeholder: groups.length ? t('groups.newGroupPlaceholder') : t('groups.firstGroupPlaceholder'),
              value: name,
              onChange: event => setName(event.target.value)
            }),
            jsx(Button, { type: 'submit', size: 'sm', disabled: !name.trim(), children: t('groups.createAndJoin') })
          ]
        }),
        current.length
          ? jsx(Button, {
              variant: 'ghost',
              size: 'sm',
              className: 'justify-self-start',
              onClick: () => saveBotMeta(bot.name, { groups: [], group: null }),
              children: t('groups.removeFromAll')
            })
          : null
      ]
    })
  })
}

/** Compact picture controls shared by group-chat creation and settings:
 *  a live preview (image, else the organization glyph), Upload / Generate /
 *  Remove. Reuses the bot-avatar pipeline (device picker, 256px normalize,
 *  image.generate probe) so room pictures cost the same as bot avatars. */
function GroupImageControls({ image, onImage, seedName, seedMembers }) {
  const t = useBotModeT()
  const imagen = useValue($imagenAvailable)
  const [busy, setBusy] = useState(false)

  if (imagen === null) {
    void probeImagen()
  }

  const upload = async () => {
    const raw = await pickImageFromDevice()

    if (raw) {
      onImage(await normalizeAvatarImage(raw))
    }
  }

  const generate = async () => {
    if (busy) {
      return
    }

    setBusy(true)

    try {
      const who = [seedName, seedMembers?.length ? `a team of ${seedMembers.join(', ')}` : '']
        .filter(Boolean)
        .join(' — ')
      const res = await host.request('image.generate', {
        prompt:
          `Group chat icon for an AI agent team called "${who || 'a bot team'}". ` +
          'Friendly minimal emblem, bold flat vector style, solid color background, centered, no text.',
        aspect_ratio: 'square'
      })

      if (!res?.success) {
        throw new Error(res?.error || t('avatar.generationFailed'))
      }

      const img = res.image_data || res.image

      if (img) {
        onImage(await normalizeAvatarImage(img))
      }
    } catch (err) {
      host.notifyError(err, t('groups.pictureFailed'))
    } finally {
      setBusy(false)
    }
  }

  return jsxs('div', {
    className: 'flex items-center gap-2',
    children: [
      jsx('div', {
        className:
          'flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-(--chrome-action-hover)',
        children: image
          ? jsx('img', { src: image, alt: '', className: 'size-full object-cover' })
          : jsx(Codicon, { name: 'organization', className: 'text-(--ui-text-tertiary)' })
      }),
      jsx(Button, { type: 'button', variant: 'secondary', size: 'sm', onClick: upload, children: t('common.upload') }),
      imagen
        ? jsx(Button, {
            type: 'button',
            variant: 'secondary',
            size: 'sm',
            disabled: busy,
            onClick: generate,
            children: busy ? t('common.generating') : t('common.generate')
          })
        : null,
      image
        ? jsx(Button, {
            type: 'button',
            variant: 'ghost',
            size: 'sm',
            onClick: () => onImage(null),
            children: t('common.remove')
          })
        : null
    ]
  })
}

/** Edit an existing group chat's name and picture. Renames re-key the room
 *  and every local member's membership (renameGroupChat); the picture rides
 *  the room record. Both apply on Save so a cancelled dialog changes nothing. */
function GroupChatSettingsDialog({ group, members, open, onClose, onRenamed }) {
  const t = useBotModeT()
  const rooms = useValue($groupChats)
  const current = (rooms[group] || {}).image || null
  const [name, setName] = useState(group)
  const [image, setImage] = useState(current)

  useEffect(() => {
    if (open) {
      setName(group)
      setImage(current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, group])

  const save = async () => {
    const finalName = await renameGroupChat(group, name, members)

    if (finalName === null) {
      return // collision — dialog stays open for a different name
    }

    if (image !== current) {
      setGroupChatImage(finalName, image)
    }

    onClose()

    if (finalName !== group) {
      onRenamed?.(finalName)
    }
  }

  return jsx(Dialog, {
    open,
    onOpenChange: value => {
      if (!value) {
        onClose()
      }
    },
    children: jsxs(DialogContent, {
      className: 'max-w-sm',
      children: [
        jsxs(DialogHeader, {
          children: [
            jsx(DialogTitle, { children: t('groups.settingsTitle') }),
            jsx(DialogDescription, {
              children: t('groups.settingsSubtitle')
            })
          ]
        }),
        jsx(GroupImageControls, {
          image,
          onImage: setImage,
          seedName: name.trim() || group,
          seedMembers: (members || []).map(b => b.name)
        }),
        jsx('form', {
          onSubmit: event => {
            event.preventDefault()
            void save()
          },
          children: jsx(Input, {
            'aria-label': t('groups.nameLabel'),
            autoFocus: true,
            maxLength: 64,
            value: name,
            onChange: event => setName(event.target.value)
          })
        }),
        jsxs(DialogFooter, {
          children: [
            jsx(Button, { variant: 'secondary', onClick: onClose, children: t('common.cancel') }),
            jsx(Button, { disabled: !name.trim(), onClick: () => void save(), children: t('common.save') })
          ]
        })
      ]
    })
  })
}

/** Discord-style group chat creation: pick 2+ bots via checkboxes (with
 *  search), name the group, create. Assignment appends to each local bot's
 *  group membership list, so the room appears in the roster and syncs
 *  cross-machine via ui_meta without replacing its other groups. */
function CreateGroupChatDialog({ open, roster, onClose, onCreated }) {
  const t = useBotModeT()
  const allMeta = useValue($botMeta)
  const [query, setQuery] = useState('')
  const [checked, setChecked] = useState({})
  const [name, setName] = useState('')
  const [image, setImage] = useState(null)

  // Reset per open so a cancelled draft doesn't leak into the next one.
  useEffect(() => {
    if (open) {
      setQuery('')
      setChecked({})
      setName('')
      setImage(null)
    }
  }, [open])

  const selected = roster.filter(bot => checked[botRosterKey(bot)])
  const visible = filterBots(roster, allMeta, query)
  const atCap = selected.length >= GROUP_CHAT_MAX_MEMBERS
  const placeholder = selected.length
    ? selected.map(bot => displayName(bot, botRosterMeta(bot, allMeta))).join(', ')
    : t('groups.nameLabel')
  const canCreate = selected.length >= 2 && Boolean(name.trim() || selected.length)

  const create = () => {
    let groupName = (name.trim() || placeholder).slice(0, 64)

    if (selected.length < 2 || !groupName) {
      return
    }

    // Creating a group is always a FRESH room. Without this, re-creating a
    // group under an existing name (easy — the default name is just the
    // member names) silently reopens the old room with its full log, which
    // reads as "not a fresh group" (db's Aug 2026 report). Uniquify against
    // both live rooms and any bot's current grouping.
    const taken = new Set(Object.keys($groupChats.get()))

    for (const meta of Object.values($botMeta.get() || {})) {
      for (const existing of botGroups(meta)) {
        taken.add(existing)
      }
    }

    if (taken.has(groupName)) {
      let n = 2

      while (taken.has(`${groupName} ${n}`)) {
        n += 1
      }

      groupName = `${groupName} ${n}`.slice(0, 64)
    }

    for (const bot of selected) {
      if (!bot.remoteSource) {
        void saveBotMeta(bot.name, groupMembershipPatch(botRosterMeta(bot, allMeta), groupName, true))
      }
    }

    // Persist every machine identity, including today's active source. That
    // member becomes remote after a source switch and cannot rely on the new
    // gateway's name-keyed bot metadata to remain seated in this room.
    const roomMembers = durableGroupChatMembers(selected)

    updateGroupChat(groupName, room => {
      room.members = roomMembers

      if (image) {
        room.image = image
      }

      return room
    })

    host.notify({ kind: 'info', message: t('groups.created', groupName, selected.length) })
    onClose()
    onCreated?.(groupName)
  }

  return jsx(Dialog, {
    open,
    onOpenChange: value => {
      if (!value) {
        onClose()
      }
    },
    children: jsxs(DialogContent, {
      className: 'max-w-md',
      children: [
        jsxs(DialogHeader, {
          children: [
            jsx(DialogTitle, { children: t('groups.createTitle') }),
            jsx(DialogDescription, {
              children: t('groups.createSubtitle', GROUP_CHAT_MAX_MEMBERS)
            })
          ]
        }),
        jsx(SearchField, {
          'aria-label': t('groups.searchLabel'),
          autoFocus: true,
          containerClassName: 'w-full',
          inputClassName: 'w-full',
          placeholder: t('groups.searchPlaceholder'),
          value: query,
          onChange: setQuery
        }),
        selected.length
          ? jsx('div', {
              className: 'flex flex-wrap gap-1',
              children: selected.map(bot =>
                jsxs('button', {
                  type: 'button',
                  className:
                    'flex items-center gap-1 rounded-full bg-(--chrome-action-hover) py-0.5 pl-2 pr-1.5 text-[0.6875rem] text-(--ui-text-secondary) transition-colors hover:text-foreground',
                  title: t('groups.removeFromSelection'),
                  onClick: () => setChecked(prev => ({ ...prev, [botRosterKey(bot)]: false })),
                  children: [displayName(bot, botRosterMeta(bot, allMeta)), jsx(Codicon, { name: 'close', className: 'text-[0.6rem]' })]
                }, botRosterKey(bot))
              )
            })
          : null,
        jsx(ScrollArea, {
          className: 'max-h-64 min-h-0',
          children: jsx('div', {
            className: 'grid gap-0.5 pr-2',
            children: visible.length
              ? visible.map(bot => {
                  const meta = botRosterMeta(bot, allMeta)
                  const { shape, color, image } = botAppearance(bot.name, meta)
                  const isChecked = Boolean(checked[botRosterKey(bot)])
                  const disabled = !isChecked && atCap
                  const currentGroups = botGroups(meta)

                  return jsxs('label', {
                    className: cn(
                      'flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-(--chrome-action-hover)',
                      disabled && 'cursor-not-allowed opacity-50'
                    ),
                    children: [
                      jsx(BotFace, {
                        shape,
                        color,
                        image: image && !isBackfilledFacePng(image) ? image : null,
                        size: 24,
                        name: bot.name
                      }),
                      jsxs('div', {
                        className: 'min-w-0 flex-1',
                        children: [
                          jsx('div', { className: 'truncate text-xs text-foreground', children: displayName(bot, meta) }),
                          jsx('div', {
                            className: 'truncate text-[0.625rem] text-(--ui-text-quaternary)',
                            children: [
                              currentGroups.length
                                ? t('groups.memberIn', botHandle(bot.name, bot), currentGroups.map(group => `“${group}”`).join(', '))
                                : `@${botHandle(bot.name, bot)}`,
                              bot.remoteSource && bot.connectionLabel ? ` · ${bot.connectionLabel}` : ''
                            ].join('')
                          })
                        ]
                      }),
                      jsx(Checkbox, {
                        checked: isChecked,
                        disabled,
                        onCheckedChange: value => setChecked(prev => ({ ...prev, [botRosterKey(bot)]: Boolean(value) }))
                      })
                    ]
                  }, botRosterKey(bot))
                })
              : jsx('div', {
                  className: 'px-1.5 py-3 text-center text-xs text-(--ui-text-tertiary)',
                  children: query.trim() ? t('roster.noMatch', query.trim()) : t('groups.noBots')
                })
          })
        }),
        jsxs('div', {
          className: 'grid gap-2',
          children: [
            jsx(GroupImageControls, {
              image,
              onImage: setImage,
              seedName: name.trim() || (selected.length ? placeholder : ''),
              seedMembers: selected.map(bot => displayName(bot, botRosterMeta(bot, allMeta)))
            }),
            jsx('form', {
              onSubmit: event => {
                event.preventDefault()
                create()
              },
              children: jsx(Input, {
                'aria-label': t('groups.nameLabel'),
                maxLength: 64,
                placeholder,
                value: name,
                onChange: event => setName(event.target.value)
              })
            })
          ]
        }),
        jsxs(DialogFooter, {
          children: [
            jsx(Button, { variant: 'secondary', onClick: onClose, children: t('common.cancel') }),
            jsx(Button, {
              disabled: !canCreate,
              title: selected.length < 2 ? t('groups.pickAtLeast') : undefined,
              onClick: create,
              children: t('groups.createButton', selected.length)
            })
          ]
        })
      ]
    })
  })
}

// ── threads: blocks of one continuous conversation ──────────────────────────
// The room reads as ONE conversation — every bot in the group hears it. Under
// the hood every entry still belongs to a THREAD, and member turns stay scoped
// to the thread that triggered them (deltas, watermarks, and responder
// resolution all key on the thread id). The user never picks one: a message
// continues the current block, and after GROUP_THREAD_GAP_MS of silence the
// next message starts a new block — a new thread — that the log marks only
// with a time separator.

function groupThreadOf(entry) {
  return entry?.thread || 'legacy'
}

function mintGroupThreadId() {
  return `t${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

// The silence that closes a block. Pre-thread logs (hydrated from storage)
// use it too: a user entry after a real lull starts a synthetic thread, so
// multi-turn tasks stay whole instead of splitting on every follow-up.
const GROUP_THREAD_GAP_MS = 15 * 60000

function assignLegacyThreads(log) {
  let current = null
  let n = 0

  return (log || []).map((entry, i) => {
    if (entry?.thread) {
      current = null

      return entry
    }

    const prev = log[i - 1]
    const lull = !prev || (entry.at || 0) - (prev.at || 0) > GROUP_THREAD_GAP_MS

    if (!current || (entry.from?.kind === 'user' && lull)) {
      current = `legacy-${n++}`
    }

    return { ...entry, thread: current }
  })
}

/** The thread a new message joins: the current block's — the thread of the
 *  latest user message — while the room spoke within GROUP_THREAD_GAP_MS;
 *  null after a lull, which mints a fresh thread (a new block). */
function groupComposerThread(log, now = Date.now()) {
  const entries = Array.isArray(log) ? log : []
  const last = entries[entries.length - 1]

  if (!last || now - (last.at || 0) >= GROUP_THREAD_GAP_MS) {
    return null
  }

  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i]?.from?.kind === 'user') {
      return groupThreadOf(entries[i])
    }
  }

  return groupThreadOf(last)
}

/** Split the log into the blocks the room shows. A user message after a lull
 *  of GROUP_THREAD_GAP_MS opens a new block — the same rule that mints a new
 *  thread — so a slow reply never splits from the question it answers.
 *  Returns [{ at, entries: [{ entry, index }] }], `index` into the log. */
function groupLogBlocks(log) {
  const entries = Array.isArray(log) ? log : []
  const blocks = []

  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index]
    const at = entry?.at || 0
    const lull = index > 0 && at - (entries[index - 1]?.at || 0) >= GROUP_THREAD_GAP_MS

    if (!blocks.length || (entry?.from?.kind === 'user' && lull)) {
      blocks.push({ at, entries: [] })
    }

    blocks[blocks.length - 1].entries.push({ entry, index })
  }

  return blocks
}

/** The app's display language as a BCP 47 tag (the shell mirrors it onto
 *  <html lang>), so dates read in the language the UI speaks. */
function documentLocale() {
  try {
    return document.documentElement.lang || undefined
  } catch {
    return undefined
  }
}

/** Clock time of a room entry ("14:58"). */
function groupClockTime(at, locale) {
  const date = new Date(at || 0)

  try {
    return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(date)
  } catch {
    return date.toLocaleTimeString()
  }
}

/** A block's separator label: "Today, 14:58", "Yesterday, 23:10", else the
 *  date ("3 Oct, 09:12" — with the year only when it isn't this year's). */
function groupBlockLabel(at, t = tr, now = Date.now(), locale = undefined) {
  const date = new Date(at || 0)
  const today = new Date(now)
  const dayStart = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  // Rounded: a DST switch makes a calendar day 23 or 25 hours long.
  const daysAgo = Math.round((dayStart(today) - dayStart(date)) / 86400000)
  const time = groupClockTime(at, locale)

  if (daysAgo === 0) {
    return t('groups.blockToday', time)
  }

  if (daysAgo === 1) {
    return t('groups.blockYesterday', time)
  }

  const sameYear = date.getFullYear() === today.getFullYear()
  let day

  try {
    day = new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      ...(sameYear ? {} : { year: 'numeric' })
    }).format(date)
  } catch {
    day = date.toLocaleDateString()
  }

  return t('groups.blockDate', day, time)
}

/** The active @-token at the caret: text from the nearest '@' (that begins a
 *  word) up to the caret, or null when the caret isn't inside a mention. */
function mentionTokenAt(text, caret) {
  const upto = String(text || '').slice(0, caret)
  const match = /(^|\s)@([a-z0-9._-]*)$/i.exec(upto)

  if (!match) {
    return null
  }

  return { query: match[2].toLowerCase(), start: caret - match[2].length - 1 }
}

/** Mention-aware composer input for group rooms. The core composer's
 *  @-completion area doesn't mount outside the chat view (#89049), so this
 *  pairs a bare composer field with a member-scoped popover: @everyone/@all
 *  quick picks plus each seated member's handle. Insertion produces exactly
 *  the strings parseGroupChatMentions resolves. Keyboard: Up/Down navigate,
 *  Enter/Tab insert (Enter falls through to submit when the popover is
 *  closed), Escape dismisses. */
function GroupMentionInput({ members, onChange, value, ...inputProps }) {
  const t = useBotModeT()
  const allMeta = useValue($botMeta)
  const inputRef = useRef(null)
  const [token, setToken] = useState(null)
  const [selected, setSelected] = useState(0)

  const options = []

  if (token) {
    for (const pick of ['everyone', 'all']) {
      if (pick.startsWith(token.query)) {
        options.push({ handle: pick, meta: t('groups.everyBot') })
      }
    }

    for (const member of members) {
      const handle = String(member.handle || botHandle(member.name, member) || '').trim()

      if (!handle || (token.query && !handle.toLowerCase().startsWith(token.query))) {
        continue
      }

      options.push({
        handle,
        meta: displayName(member, botRosterMeta(member, allMeta))
      })
    }
  }

  const open = Boolean(token) && options.length > 0
  const active = open ? Math.min(selected, options.length - 1) : 0

  const refreshToken = target => {
    setToken(mentionTokenAt(target.value, target.selectionStart ?? target.value.length))
    setSelected(0)
  }

  const insert = handle => {
    if (!token) {
      return
    }

    const caret = inputRef.current?.selectionStart ?? value.length
    const next = `${value.slice(0, token.start)}@${handle} ${value.slice(caret)}`
    onChange(next)
    setToken(null)

    // Restore focus with the caret after the inserted mention.
    const pos = token.start + handle.length + 2
    requestAnimationFrame(() => {
      const el = inputRef.current

      if (el) {
        el.focus()
        try {
          el.setSelectionRange(pos, pos)
        } catch {
          /* input type without selection support */
        }
      }
    })
  }

  return jsxs('div', {
    className: 'relative flex min-w-0 flex-1',
    children: [
      open
        ? jsx('div', {
            // The menu surface the app's dropdowns use — opaque enough that the
            // transcript under it never reads through.
            className:
              'absolute bottom-full left-0 z-50 mb-3 max-h-48 w-64 overflow-y-auto rounded-lg border border-(--ui-stroke-secondary) bg-[color-mix(in_srgb,var(--ui-bg-elevated)_96%,transparent)] p-1 shadow-md backdrop-blur-md',
            children: options.map((option, index) =>
              jsxs('button', {
                type: 'button',
                className: cn(
                  'flex w-full items-baseline gap-2 rounded-md px-2 py-1 text-left text-xs',
                  index === active ? 'bg-(--ui-control-active-background) text-foreground' : 'text-(--ui-text-secondary)'
                ),
                // preventDefault on mousedown so the input keeps focus.
                onMouseDown: event => {
                  event.preventDefault()
                  insert(option.handle)
                },
                onMouseEnter: () => setSelected(index),
                children: [
                  jsx('span', { className: 'font-medium', children: `@${option.handle}` }),
                  jsx('span', { className: 'truncate text-[0.65rem] text-(--ui-text-quaternary)', children: option.meta })
                ]
              }, option.handle)
            )
          })
        : null,
      // A composer field, not a form control: the composer surface around it
      // owns the chrome, the way the chat composer's own input does.
      jsx('input', {
        ...inputProps,
        ref: inputRef,
        type: 'text',
        className:
          'min-w-0 flex-1 border-0 bg-transparent px-1 py-0.5 text-[length:var(--conversation-text-font-size)] leading-(--dt-line-height) text-foreground outline-none placeholder:text-(--ui-text-tertiary)',
        value,
        onChange: event => {
          onChange(event.target.value)
          refreshToken(event.target)
        },
        onClick: event => refreshToken(event.target),
        onKeyDown: event => {
          if (!open) {
            return
          }

          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setSelected((active + 1) % options.length)
          } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            setSelected((active - 1 + options.length) % options.length)
          } else if (event.key === 'Enter' || event.key === 'Tab') {
            event.preventDefault()
            insert(options[active].handle)
          } else if (event.key === 'Escape') {
            event.preventDefault()
            setToken(null)
          }
        },
        onBlur: () => setToken(null)
      })
    ]
  })
}

/** The room for one group: ONE continuous conversation that every bot in the
 *  group hears. The user's lines are bubbles on the right and members speak
 *  on the left — the reading shape of a bot's 1:1 chat. After a lull of
 *  GROUP_THREAD_GAP_MS the next message opens a new block (a new thread under
 *  the hood), marked only by a time separator. The room renders on the center
 *  page, beside a roster that never changes; `onBack` exists only for the
 *  Bots-pane fallback on desktops without plugin pages, where the room takes
 *  the roster's place. */
function GroupChatWorkspace({ group, members, onBack }) {
  const t = useBotModeT()
  const rooms = useValue($groupChats)
  const allMeta = useValue($botMeta)
  const room = rooms[group] || { log: [], running: false }
  const [draft, setDraft] = useState('')
  const [confirmDisband, setConfirmDisband] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  // Click-to-disambiguate: which log entry is showing its speaker's full
  // @handle (the roster's name-device form when names collide across
  // connections). Naturally every speaker just shows its display name.
  const [revealedSpeaker, setRevealedSpeaker] = useState(null)
  // Pending attachments for the composer. Data URLs, already downscaled —
  // they ride the send into every responding member's session.
  const [pendingImages, setPendingImages] = useState([])

  const addImages = picked => {
    if (picked.length) {
      setPendingImages(prev => [...prev, ...picked])
    }
  }

  const removeImage = index => setPendingImages(prev => prev.filter((_, i) => i !== index))

  // Ctrl/⌘-V a screenshot (or any file) into the composer.
  const pasteImages = event => {
    const files = [...(event.clipboardData?.files || [])]

    if (!files.length) {
      return
    }

    event.preventDefault()
    void filesToGroupAttachments(files).then(addImages)
  }

  // Drag & drop anywhere on the room attaches to the composer — matches the
  // 1:1 chat's drop affordance.
  const [dragOver, setDragOver] = useState(false)

  const dropFiles = event => {
    const files = [...(event.dataTransfer?.files || [])]

    setDragOver(false)

    if (!files.length) {
      return
    }

    event.preventDefault()
    void filesToGroupAttachments(files).then(addImages)
  }

  // Follow the conversation: while the reader sits at the newest line, the
  // log stays pinned to it as replies (and their images) grow it; scrolling
  // up to read history parks it there until they come back down. Their own
  // send always brings it back.
  const logRef = useRef(null)
  const followRef = useRef(true)

  useEffect(() => {
    const content = logRef.current
    const viewport = content?.closest?.('[data-slot="scroll-area-viewport"]')

    if (!content || !viewport) {
      return undefined
    }

    const stick = () => {
      if (followRef.current) {
        viewport.scrollTop = viewport.scrollHeight
      }
    }

    const onScroll = () => {
      followRef.current = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 48
    }

    const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(stick) : null

    stick()
    resize?.observe(content)
    resize?.observe(viewport)
    viewport.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      resize?.disconnect()
      viewport.removeEventListener('scroll', onScroll)
    }
  }, [])

  // Collapsible Activity view: collapsed by default — opening it is always an
  // explicit user action, it never steals focus, and it never auto-scrolls.
  const [activityOpen, setActivityOpen] = useState(false)
  // Subscribe: activity rows re-render as turn events land.
  useValue($groupActivity)

  const memberNames = members.map(b => displayName(b, botRosterMeta(b, allMeta))).join(', ')

  // Header: the room as a centered pill (picture or member faces, name, size)
  // with its settings and disband actions at the right edge. No Back — the
  // roster beside the page is the navigation. On a narrow pane the side
  // columns keep their buttons and the pill's name truncates instead.
  const header = jsxs('div', {
    className: 'grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-2',
    children: [
      jsx('div', {
        className: 'flex min-w-0 items-center',
        children: onBack
          ? jsx(Button, { variant: 'ghost', size: 'sm', onClick: onBack, children: t('common.back') })
          : null
      }),
      jsxs('div', {
        className: 'flex min-w-0 items-center gap-2 rounded-full border border-(--ui-stroke-tertiary) py-1 pr-3 pl-1.5',
        children: [
          // Room picture (set via Group settings) leads the title when present;
          // else the member faces, matching each bot's avatar in the roster.
          room.image
            ? jsx('img', {
                src: room.image,
                alt: '',
                className: 'size-5 shrink-0 rounded-full object-cover'
              })
            : jsx(Tip, {
                label: memberNames,
                children: jsx('span', {
                  className: 'flex shrink-0 items-center -space-x-1.5',
                  children: members.slice(0, 3).map(b => {
                    const { shape, color, image } = botAppearance(b.name, botRosterMeta(b, allMeta))
                    const photo = Boolean(image && !isBackfilledFacePng(image))

                    return jsx(
                      'span',
                      {
                        className: 'rounded-full ring-2 ring-(--ui-chat-surface-background)',
                        children: jsx(BotFace, { shape, color, image: photo ? image : null, size: 20, name: b.name })
                      },
                      botRosterKey(b)
                    )
                  })
                })
              }),
          jsx('h1', { className: 'min-w-0 truncate text-[0.8125rem] font-semibold', children: group }),
          jsx('span', {
            className: 'shrink-0 text-[0.6875rem] text-(--ui-text-tertiary)',
            children: t('groups.botCount', members.length)
          })
        ]
      }),
      jsxs('div', {
        className: 'flex items-center justify-end gap-0.5',
        children: [
          jsx(Tip, {
            label: t('groups.settingsTooltip', group),
            children: jsx(Button, {
              variant: 'ghost',
              size: 'icon-sm',
              'aria-label': t('groups.settingsTitle'),
              onClick: () => setSettingsOpen(true),
              children: jsx(Codicon, { name: 'gear' })
            })
          }),
          jsx(Tip, {
            label: t('groups.disbandTooltip', group),
            children: jsx(Button, {
              variant: 'ghost',
              size: 'icon-sm',
              'aria-label': t('groups.disbandTooltip', group),
              onClick: () => setConfirmDisband(true),
              children: jsx(Codicon, { name: 'trash' })
            })
          })
        ]
      })
    ]
  })

  const memberDescriptors = () =>
    members.map(b => ({
      ...b,
      title: (b.remoteSource ? '' : allMeta[b.name]?.title) || b.title || ''
    }))

  // Activity disclosure: quiet, collapsed by default. The collapsed row shows
  // the latest event; expanding lists the current run's events newest-first.
  // Events are epoch-tagged, so a superseded run's history drops out of view.
  const activityEvents = currentGroupActivity(group)
  const latestActivity = activityEvents.length ? activityEvents[activityEvents.length - 1] : null
  const activityPanel = jsxs('div', {
    className: 'border-b border-(--ui-stroke-secondary)',
    children: [
      jsxs('button', {
        type: 'button',
        'aria-expanded': activityOpen,
        'aria-controls': `group-activity:${group}`,
        title: activityOpen ? t('groups.hideActivity') : t('groups.showActivity'),
        className:
          'flex w-full items-center gap-1.5 px-2.5 py-1 text-left text-[0.7rem] text-(--ui-text-quaternary) transition-colors hover:text-foreground',
        onClick: () => setActivityOpen(prev => !prev),
        children: [
          jsx(Codicon, {
            name: activityOpen ? 'chevron-down' : 'chevron-right',
            className: 'shrink-0 text-[0.65rem]'
          }),
          jsx('span', { className: 'shrink-0 font-medium', children: t('groups.activityTitle') }),
          latestActivity
            ? jsx('span', {
                className: 'min-w-0 flex-1 truncate',
                children: `${groupActivityLabel(latestActivity, t)} · ${relativeTime(latestActivity.at)}`
              })
            : null
        ]
      }),
      activityOpen
        ? jsx('div', {
            id: `group-activity:${group}`,
            className: 'grid gap-0.5 px-2.5 pb-1.5',
            children: activityEvents.length
              ? [...activityEvents]
                  .reverse()
                  .map((event, i) =>
                    jsxs('div', {
                      className: 'flex items-center gap-1.5 text-[0.7rem]',
                      children: [
                        jsx(Codicon, {
                          name: GROUP_ACTIVITY_GLYPHS[event.kind] || 'circle-outline',
                          className: cn('shrink-0 text-[0.65rem]', groupActivityTone(event.kind))
                        }),
                        jsx('span', {
                          className: cn('min-w-0 flex-1 truncate', groupActivityTone(event.kind)),
                          children: groupActivityLabel(event, t)
                        }),
                        jsx('span', {
                          className: 'shrink-0 text-[0.625rem] text-(--ui-text-quaternary)',
                          children: relativeTime(event.at)
                        })
                      ]
                    }, `${event.at}:${i}`)
                  )
              : jsx('div', {
                  className: 'px-0.5 pb-0.5 text-[0.625rem] text-(--ui-text-quaternary)',
                  children: t('groups.noActivity')
                })
          })
        : null
    ]
  })

  const submit = () => {
    const text = draft.trim()
    const images = pendingImages

    if ((!text && !images.length) || !members.length) {
      return
    }

    setDraft('')
    setPendingImages([])
    // Their own message always brings the log back to the newest line.
    followRef.current = true
    // One continuous conversation: the message joins the current block's
    // thread, or opens a new block after a lull. Full descriptors ride into
    // the turn loop: remote members keep their connection fields so their
    // turns route to their own machines.
    sendToGroupChat(group, memberDescriptors(), text, groupComposerThread(room.log), images)
  }

  // Pending attachments above the composer: image chips preview the pixels,
  // PDFs/files show a type icon. X removes one.
  const attachmentRow = pendingImages.length
    ? jsx('div', {
        className: 'flex flex-wrap items-center gap-1.5',
        children: pendingImages.map((img, index) =>
          jsxs(
            'div',
            {
              className: 'flex items-center gap-1 rounded-md border border-(--ui-stroke-tertiary) px-1 py-0.5',
              children: [
                img.kind === 'pdf' || img.kind === 'file'
                  ? jsx(Codicon, {
                      name: img.kind === 'pdf' ? 'file-pdf' : 'file',
                      className: 'text-[0.9rem] text-(--ui-text-tertiary)'
                    })
                  : jsx('img', { src: img.data, alt: '', className: 'size-6 rounded object-cover' }),
                jsx('span', {
                  className: 'max-w-32 truncate text-[0.6875rem] text-(--ui-text-tertiary)',
                  children: img.name || t('groups.image')
                }),
                jsx('button', {
                  type: 'button',
                  'aria-label': t('groups.removeAttachment'),
                  className:
                    'cursor-pointer border-0 bg-transparent p-0 text-(--ui-text-tertiary) hover:text-foreground',
                  onClick: () => removeImage(index),
                  children: jsx(Codicon, { name: 'close', className: 'text-[0.65rem]' })
                })
              ]
            },
            `${img.name || 'img'}:${index}`
          )
        )
      })
    : null

  const locale = documentLocale()

  // One room line. The user's lines are bubbles on the right; a member's line
  // is its face, name and clock time, then the markdown body. Attachments
  // (what every responding bot was shown) ride under the text either way.
  const renderEntry = (entry, index) => {
    const isUser = entry.from.kind === 'user'
    const entryKey = `${entry.at}:${index}`
    const text = String(entry.text || '')
    // Hover-revealed copy, the same affordance on every line.
    const copy = text.trim()
      ? jsx('div', {
          className:
            'ml-auto shrink-0 opacity-0 pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100',
          children: jsx(CopyButton, { appearance: 'icon', buttonSize: 'icon', stopPropagation: true, text: entry.text })
        })
      : null
    const attachments =
      Array.isArray(entry.images) && entry.images.length
        ? jsx('div', {
            className: cn('mt-1.5 flex flex-wrap items-center gap-1.5', isUser && 'justify-end'),
            children: entry.images.map((img, imgIndex) =>
              img.kind === 'pdf' || img.kind === 'file'
                ? jsxs(
                    'div',
                    {
                      className:
                        'flex items-center gap-1 rounded-md border border-(--ui-stroke-tertiary) px-1.5 py-1 text-[0.6875rem] text-(--ui-text-tertiary)',
                      title: img.name || t('groups.attachedFile'),
                      children: [
                        jsx(Codicon, { name: img.kind === 'pdf' ? 'file-pdf' : 'file', className: 'text-[0.8rem]' }),
                        jsx('span', { className: 'max-w-48 truncate', children: img.name || t('groups.attachedFile') })
                      ]
                    },
                    `${entryKey}:img:${imgIndex}`
                  )
                : jsx(
                    'img',
                    {
                      src: img.data,
                      alt: img.name || t('groups.attachedImage'),
                      title: img.name || t('groups.attachedImage'),
                      className: 'max-h-40 max-w-60 rounded-md border border-(--ui-stroke-tertiary) object-contain'
                    },
                    `${entryKey}:img:${imgIndex}`
                  )
            )
          })
        : null

    if (isUser) {
      return jsxs(
        'div',
        {
          className: 'group flex items-start justify-end gap-1',
          children: [
            copy,
            jsxs('div', {
              className: 'flex min-w-0 max-w-[80%] flex-col items-end',
              children: [
                text.trim()
                  ? jsx('div', {
                      className:
                        'min-w-0 max-w-full whitespace-pre-wrap wrap-anywhere rounded-(--prompt-bubble-radius) bg-(--dt-user-bubble) px-3.5 py-2 text-[length:var(--conversation-text-font-size)] leading-(--dt-line-height) text-foreground/95',
                      // The app shell sets user-select: none globally; message
                      // bodies opt back in so drag-select and ⌘C work here.
                      'data-selectable-text': 'true',
                      children: text
                    })
                  : null,
                attachments
              ]
            })
          ]
        },
        entryKey
      )
    }

    const meta = entry.from.source ? null : allMeta[entry.from.name]
    // Match this speaker back to its member descriptor so display names and
    // disambiguating handles come from the roster (the primary "default"
    // profile renders as Work4You, remote dupes carry their @name-device
    // handle) instead of raw profile ids.
    const member =
      members.find(
        b =>
          b.name === entry.from.name &&
          (entry.from.source ? (b.connectionLabel || b.connectionId) === entry.from.source : !b.remoteSource)
      ) || null
    const display = displayName(member || { name: entry.from.name }, meta)
    const revealed = revealedSpeaker === entryKey
    // Clicked: append the gateway name so same-named agents on two
    // connections are tellable apart on demand.
    const label = revealed
      ? `${display}${entry.from.source ? `-${entry.from.source}` : ''} (@${botHandle(entry.from.name, member || undefined)})`
      : display
    // Speaker avatar: same appearance pipeline as the roster (custom
    // image/pet, else deterministic shape+color face). Remote speakers have
    // no local meta and get the deterministic face for their name.
    const { shape, color, image } = botAppearance(entry.from.name, meta)
    const photo = Boolean(image && !isBackfilledFacePng(image))

    return jsxs(
      'div',
      {
        className: 'group flex items-start gap-2.5',
        children: [
          jsx('div', {
            className: 'mt-0.5 shrink-0',
            children: jsx(BotFace, { shape, color, image: photo ? image : null, size: 26, name: entry.from.name })
          }),
          jsxs('div', {
            className: 'min-w-0 flex-1',
            children: [
              jsxs('div', {
                className: 'flex min-w-0 items-center gap-2',
                children: [
                  jsx(Tip, {
                    label: revealed ? t('groups.hideHandle') : t('groups.showHandle'),
                    children: jsx('button', {
                      type: 'button',
                      className:
                        'min-w-0 cursor-pointer truncate border-0 bg-transparent p-0 text-left text-xs font-semibold text-foreground',
                      onClick: () => setRevealedSpeaker(revealed ? null : entryKey),
                      children: label
                    })
                  }),
                  jsx('span', {
                    className: 'shrink-0 text-[0.6875rem] text-(--ui-text-tertiary)',
                    children: groupClockTime(entry.at, locale)
                  }),
                  copy
                ]
              }),
              jsx('div', {
                className:
                  'text-[length:var(--conversation-text-font-size)] leading-(--dt-line-height) text-foreground [&_ol]:mb-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-1.5 [&_p:last-child]:mb-0 [&_pre]:overflow-x-auto [&_ul]:mb-1.5 [&_ul]:list-disc [&_ul]:pl-5',
                'data-selectable-text': 'true',
                children: Streamdown ? jsx(Streamdown, { children: text }) : text
              }),
              attachments
            ]
          })
        ]
      },
      entryKey
    )
  }

  // The log reads top to bottom as one conversation. Each block opens with a
  // time separator ("Today, 14:58") — the only mark a new block gets.
  const now = Date.now()
  const logChildren = []

  for (const block of groupLogBlocks(room.log)) {
    const label = groupBlockLabel(block.at, t, now, locale)

    logChildren.push(
      jsxs(
        'div',
        {
          role: 'separator',
          'aria-label': label,
          className: 'flex items-center gap-3 text-[0.6875rem] text-(--ui-text-tertiary)',
          children: [
            jsx('span', { 'aria-hidden': true, className: 'h-px flex-1 bg-(--ui-stroke-tertiary)' }),
            jsx('span', { 'aria-hidden': true, className: 'shrink-0', children: label }),
            jsx('span', { 'aria-hidden': true, className: 'h-px flex-1 bg-(--ui-stroke-tertiary)' })
          ]
        },
        `block:${block.entries[0].index}`
      )
    )

    for (const { entry, index } of block.entries) {
      logChildren.push(renderEntry(entry, index))
    }
  }

  return jsxs('div', {
    className: 'relative flex h-full min-h-0 flex-col',
    onDragOver: event => {
      if ([...(event.dataTransfer?.types || [])].includes('Files')) {
        event.preventDefault()
        setDragOver(true)
      }
    },
    onDragLeave: event => {
      // Only clear when leaving the room container itself, not when the
      // cursor moves between its children.
      if (!event.currentTarget.contains(event.relatedTarget)) {
        setDragOver(false)
      }
    },
    onDrop: dropFiles,
    children: [
      dragOver
        ? jsx(
            'div',
            {
              className:
                'pointer-events-none absolute inset-0 z-40 flex items-center justify-center border-2 border-dashed border-(--ui-accent,#4f9cf9) text-sm font-medium text-(--ui-accent,#4f9cf9)',
              children: t('groups.dropToAttach')
            },
            'dropzone'
          )
        : null,
      header,
      activityPanel,
      jsx(ScrollArea, {
        className: 'min-h-0 flex-1',
        children: jsxs('div', {
          ref: logRef,
          className: 'mx-auto flex w-[min(var(--composer-width),calc(100%-2rem))] flex-col gap-4 pt-4 pb-3',
          children: [
            ...(room.log.length
              ? logChildren
              : [jsx(EmptyState, { title: group, description: t('groups.emptyRoom') }, 'empty')]),
            room.running
              ? jsxs(
                  'div',
                  {
                    role: 'status',
                    className: 'flex items-center gap-2 text-xs text-(--ui-text-tertiary)',
                    children: [
                      jsx(GlyphSpinner, { spinner: 'breathe', className: 'text-(--ui-text-tertiary)' }),
                      jsx('span', {
                        className: 'italic',
                        children: room.turn
                          ? t('groups.thinking', groupSpeakerLabel(room.turn))
                          : t('groups.roomWorking')
                      })
                    ]
                  },
                  'working'
                )
              : null
          ]
        })
      }),
      // The composer: one surface — attach, the message, send — in the same
      // centered column as the log, like the chat composer.
      jsxs('form', {
        className: 'mx-auto grid w-[min(var(--composer-width),calc(100%-2rem))] gap-1.5 pt-1 pb-3',
        onSubmit: event => {
          event.preventDefault()
          submit()
        },
        children: [
          attachmentRow,
          jsxs('div', {
            className:
              'flex items-center gap-1 rounded-(--composer-radius) border border-(--ui-stroke-secondary) bg-(--composer-fill) p-1.5 transition-colors focus-within:border-(--ui-stroke-primary)',
            children: [
              jsx(Tip, {
                label: t('groups.attachFiles'),
                children: jsx(Button, {
                  type: 'button',
                  variant: 'ghost',
                  size: 'icon-xs',
                  'aria-label': t('groups.attachFiles'),
                  onClick: () => void pickGroupAttachments().then(addImages),
                  children: jsx(Codicon, { name: 'attach' })
                })
              }),
              jsx(GroupMentionInput, {
                'aria-label': t('groups.messageLabel', group),
                autoFocus: true,
                placeholder: t('groups.composerPlaceholder', group),
                members,
                value: draft,
                onChange: setDraft,
                onPaste: pasteImages
              }),
              jsx(Button, {
                type: 'submit',
                size: 'icon-xs',
                'aria-label': t('groups.send'),
                disabled: (!draft.trim() && !pendingImages.length) || !members.length,
                children: jsx(Codicon, { name: 'arrow-up' })
              })
            ]
          })
        ]
      }),
      jsx(GroupChatSettingsDialog, {
        group,
        members,
        open: settingsOpen,
        onClose: () => setSettingsOpen(false)
      }),
      jsx(ConfirmDialog, {
        open: confirmDisband,
        title: t('groups.disbandTitle'),
        description: jsxs('span', {
          children: [
            t('groups.disbandBodyStart'),
            jsx('span', { className: 'font-medium text-foreground', children: group }),
            t('groups.disbandBodyMiddle', String(members.length)),
            group,
            t('groups.disbandBodyEnd')
          ]
        }),
        destructive: true,
        confirmLabel: t('groups.disband'),
        busyLabel: t('groups.disbanding'),
        doneLabel: t('groups.disbanded'),
        onClose: () => setConfirmDisband(false),
        onConfirm: async () => {
          await disbandGroupChat(group, members)
          host.notify({ kind: 'success', message: t('groups.disbandedNotice', group) })
        }
      })
    ]
  })
}

/** Center-page path of the open group room — where a bot's chat renders, so
 *  the roster beside it never changes. */
const GROUP_ROOM_PATH = '/workbots-group'

/** Set once register() mounts the room page. Older desktops without plugin
 *  pages keep the room inside the Bots pane. */
let groupRoomPageRegistered = false

/** Select a group room and remember it: the app reopens its last route on
 *  launch, and the room page has to know which group it was showing. */
function selectGroupRoom(group) {
  $groupChatWorkspace.set(group || null)

  try {
    Promise.resolve(pluginCtx?.storage?.set?.('open-group', group || null)).catch(() => undefined)
  } catch {
    /* storage unavailable — the selection holds for this window only */
  }
}

/** The group whose room is ON SCREEN, else null. The selection outlives a
 *  trip to a bot's chat; the roster highlight must not. */
function useOpenGroupRoom() {
  const selected = useValue($groupChatWorkspace)
  const views = useValue($groupRoomViews)

  return views > 0 ? selected : null
}

/** The room page (GROUP_ROOM_PATH). Seats the member roster reactively (live
 *  roster + bot meta + the room's stored cross-connection descriptors) so the
 *  room keeps working as members change, and keys the room by group so a
 *  draft never follows the user into another group. */
function GroupChatMainView() {
  const t = useBotModeT()
  const group = useValue($groupChatWorkspace)
  const allMeta = useValue($botMeta)
  // Subscribe: membership changes ride bot meta AND the room record.
  const rooms = useValue($groupChats)
  // The page can be on screen without the Bots pane (a relaunch restores the
  // last route), so it reads the roster itself — from the shared cache, no
  // second poller. Seating from the live roster keeps local members on their
  // bare-name identity (their sessions and watermarks).
  const { data } = useRoster({ poll: false })
  const lastRoster = useValue($lastRoster)
  const roster = Array.isArray(data?.profiles) ? data.profiles : lastRoster
  const known = Boolean(group) && groupChatNames(allMeta, rooms, roster).includes(group)

  // Count this view while it is mounted: the roster lights the open room's
  // row only while the room is on screen.
  useEffect(() => {
    $groupRoomViews.set($groupRoomViews.get() + 1)

    return () => $groupRoomViews.set(Math.max(0, $groupRoomViews.get() - 1))
  }, [])

  return jsx('div', {
    className: 'flex h-full min-h-0 min-w-0 flex-col bg-(--ui-chat-surface-background)',
    children: known
      ? jsx(GroupChatWorkspace, { group, members: groupChatMemberBots(group, roster, allMeta) }, group)
      : jsx(EmptyState, {
          className: 'flex-1',
          title: t('groups.noRoomTitle'),
          description: t('groups.noRoomDescription')
        })
  })
}

/** Open a group chat the Grok way: its conversation takes the center page,
 *  where a bot's chat renders, and the roster stays put — moving between bots
 *  and groups is one click. Desktops without plugin pages fall back to the
 *  room inside the Bots pane. */
function openGroupChat(group) {
  $groupNeedsYou.set({ ...$groupNeedsYou.get(), [group]: false })
  selectGroupRoom(group)

  if (groupRoomPageRegistered) {
    host.navigate(GROUP_ROOM_PATH)
  }
}

/** One group chat as ONE roster row — the Discord shape: stacked member
 *  avatars, group name, member count, the newest room line as the preview
 *  (markdown flattened), relative time of the last activity, and the
 *  needs-you badge on the row itself. Sorts into the same recency ordering
 *  as bot rows; clicking opens the room on the center page. */
function GroupRow({ active, group, members, needsYou, onOpen }) {
  const t = useBotModeT()
  const rooms = useValue($groupChats)
  const allMeta = useValue($botMeta)
  const room = rooms[group] || { log: [] }
  const log = Array.isArray(room.log) ? room.log : []
  const last = log.length ? log[log.length - 1] : null
  const lastAt = groupLastActivity(room)
  // Room previews speak the same handle vocabulary as the roster, mentions
  // and the group prompt: the primary profile is @work4you, not @default.
  const lastFrom = last?.from?.name || ''
  const lastHandle = botHandle(lastFrom || 'bot', members.find(member => member?.name === lastFrom))
  const preview = last
    ? `${last.from?.kind === 'user' ? t('groups.you') : `@${lastHandle}`}: ${stripPreviewMarkdown(last.text) || '…'}`
    : t('groups.noMessagesRoom')
  const faces = members.slice(0, 3)

  return jsxs('button', {
    type: 'button',
    onClick: () => {
      haptic('tap')
      onOpen(group)
    },
    className: cn(
      'flex w-full min-w-0 max-w-full items-center gap-2.5 overflow-hidden rounded-md px-2 py-2 text-left transition-colors',
      'hover:bg-(--chrome-action-hover)',
      active && 'bg-(--ui-row-active-background)'
    ),
    children: [
      // Room picture when the user set one; else a composite avatar of up to
      // three member faces fanned like Discord's group-DM icon; a bare glyph
      // when the room has no seated members.
      jsx('div', {
        className: 'flex w-[34px] shrink-0 items-center justify-center',
        children: room.image
          ? jsx('img', {
              src: room.image,
              alt: '',
              className: 'size-7 rounded-full object-cover ring-2 ring-(--ui-bg-primary,#111)'
            })
          : faces.length
          ? jsx('div', {
              className: 'flex items-center -space-x-2.5',
              children: faces.map(member => {
                const meta = member.remoteSource ? null : allMeta[member.name]
                const { shape, color, image } = botAppearance(member.name, meta)

                return jsx(
                  'div',
                  {
                    className: 'rounded-full ring-2 ring-(--ui-bg-primary,#111)',
                    children: jsx(BotFace, {
                      shape,
                      color,
                      image: image && !isBackfilledFacePng(image) ? image : null,
                      size: 20,
                      name: member.name,
                      mood: 'idle'
                    })
                  },
                  botRosterKey(member)
                )
              })
            })
          : jsx(Codicon, { name: 'organization', className: 'text-(--ui-text-tertiary)' })
      }),
      jsxs('div', {
        className: 'min-w-0 flex-1',
        children: [
          jsxs('div', {
            className: 'flex items-baseline justify-between gap-2',
            children: [
              jsxs('div', {
                className: 'flex min-w-0 items-baseline gap-1.5 truncate',
                children: [
                  jsx('span', { className: 'truncate text-[0.8125rem] font-medium', children: group }),
                  jsx('span', {
                    className: 'shrink-0 text-[0.6875rem] text-(--ui-text-quaternary)',
                    children: t('groups.botCount', members.length)
                  })
                ]
              }),
              needsYou
                ? jsx('span', {
                    className:
                      'shrink-0 rounded-full bg-(--ui-accent,#4f9cf9) px-1.5 text-[0.6rem] font-semibold text-white',
                    title: t('groups.needsInput'),
                    children: t('groups.needsYou')
                  })
                : null,
              lastAt
                ? jsx('span', {
                    className: 'shrink-0 text-[0.6875rem] text-(--ui-text-quaternary)',
                    children: relativeTime(lastAt)
                  })
                : null
            ]
          }),
          jsx('div', {
            className: 'min-w-0 truncate text-xs text-(--ui-text-tertiary)',
            children: preview
          })
        ]
      })
    ]
  })
}

function BotsPane() {
  const t = useBotModeT()
  const { data, error, isLoading, refetch } = useRoster()
  const gatewayState = useValue(host.state.gateway)
  const gatewayUp = gatewayState === 'open'
  const activeProfile = (useValue(host.state.profile) || 'default').trim() || 'default'
  const [createOpen, setCreateOpen] = useState(false)
  const [groupCreateOpen, setGroupCreateOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [grouping, setGrouping] = useState(null)
  const [query, setQuery] = useState('')
  const activityToasts = useValue($activityToasts)
  const sessionsWorkspaceName = useValue($botSessionsWorkspace)
  const groupChatName = useValue($groupChatWorkspace)
  const openGroup = useOpenGroupRoom()
  const groupNeedsYou = useValue($groupNeedsYou)
  const groupRooms = useValue($groupChats)

  // The socket opening (boot, SSH reconnect, sleep/wake) is the signal to
  // retry immediately instead of waiting out the poll interval.
  useEffect(() => {
    if (gatewayUp) {
      void refetch()
    }
  }, [gatewayUp, refetch])
  const allMeta = useValue($botMeta)
  // Messaging-app order: most recent activity first, where "activity" is
  // the newest of (bot created, last message in any of its sessions). A
  // freshly created bot tops the list until another bot gets a message.
  // No special slot for the primary bot — it competes on recency too.
  const activityOf = bot => {
    const created = botRosterMeta(bot, allMeta)?.created || bot.ui_meta?.['work4you-bots']?.created || 0
    const lastMsg = (botActivitySession(bot)?.last_active || 0) * 1000

    return Math.max(created, lastMsg)
  }
  // Pinned bots (right-click → Pin) float to the top as a group; within the
  // pinned group and within the unpinned group, recency still rules. A
  // plain boolean flag in bot-meta (rides ui_meta to every machine).
  const isPinned = bot => Boolean(botRosterMeta(bot, allMeta)?.pinned)
  // Resilience (@wesleysimplicio, #13): a failed refresh must not erase a
  // roster the user already had — mixed local+cloud gateways and remotes
  // waking from sleep fail transiently. Render the last good snapshot with
  // a notice; the full error card is reserved for "never had a roster".
  const live = Array.isArray(data?.profiles) ? data.profiles : null
  const source = live ?? (error ? $lastRoster.get() : [])
  const roster = source.slice().sort((a, b) => {
    const pa = isPinned(a) ? 1 : 0
    const pb = isPinned(b) ? 1 : 0

    if (pa !== pb) {
      return pb - pa
    }

    return activityOf(b) - activityOf(a)
  })
  const activeSourceRoster = roster.filter(bot => !bot.remoteSource)
  // Hidden bots (right-click → Hide Bot) drop out of the roster list unless
  // the header eye toggle reveals them. Display-only: every other consumer
  // (mentions, group chats, name-collision checks, merge/avatar/activity
  // sweeps) keeps the FULL roster.
  const showHidden = useValue($showHiddenBots)
  const unreadByName = useValue($botUnread)
  const hiddenBots = roster.filter(bot => isBotHidden(bot, allMeta))
  const hiddenUnread = hiddenBots.some(bot => !bot.remoteSource && unreadByName[bot.name])
  const visibleRoster = showHidden ? roster : roster.filter(bot => !isBotHidden(bot, allMeta))
  const filteredRoster = filterBots(visibleRoster, allMeta, query)
  // Group chats are first-class roster rows (Discord-style): one standalone
  // row per room, competing in the SAME recency ordering as bot rows — a
  // group's activity is its newest room-log line. Pinned bots still lead;
  // groups and unpinned bots interleave by recency below them.
  const needle = query.trim().toLowerCase()
  const groupRows = groupChatNames(allMeta, groupRooms, roster)
    .filter(name => !needle || name.toLowerCase().includes(needle))
    .map(name => ({
      kind: 'group',
      name,
      members: groupChatMemberBots(name, roster, allMeta),
      activity: groupLastActivity(groupRooms[name])
    }))
  const rosterRows = [
    ...filteredRoster.map(bot => ({ kind: 'bot', bot, pinned: isPinned(bot), activity: activityOf(bot) })),
    ...groupRows
  ].sort((a, b) => {
    const pa = a.pinned ? 1 : 0
    const pb = b.pinned ? 1 : 0

    if (pa !== pb) {
      return pb - pa
    }

    return b.activity - a.activity
  })

  if (live) {
    $lastRoster.set(roster)
    mergeServerMeta(activeSourceRoster)
    pullServerAvatars(activeSourceRoster)
    trackInboundActivity(activeSourceRoster)
    backfillMessagingProtocol(activeSourceRoster)
  }

  const staleNotice =
    error && !live && roster.length ? t('roster.staleNotice') + (gatewayUp ? '' : t('roster.waitingReconnect')) : null
  const sessionsWorkspaceBot = roster.find(bot => bot.name === sessionsWorkspaceName)

  if (sessionsWorkspaceBot) {
    return jsx(ProfileSessionsWorkspace, { bot: sessionsWorkspaceBot })
  }

  // Desktops without plugin pages: the selected room takes the roster's place
  // here, with a Back button to return to it.
  const paneRoomMembers =
    !groupRoomPageRegistered && groupChatName ? groupChatMemberBots(groupChatName, roster, allMeta) : []

  if (paneRoomMembers.length) {
    return jsx(
      GroupChatWorkspace,
      { group: groupChatName, members: paneRoomMembers, onBack: () => selectGroupRoom(null) },
      groupChatName
    )
  }

  return jsxs('div', {
    className: 'flex h-full flex-col',
    children: [
      jsxs('div', {
        className: 'flex items-center justify-between gap-2 px-2.5 pt-2.5 pb-1.5',
        children: [
          jsx('span', {
            className: 'text-[0.6875rem] font-semibold uppercase tracking-wider text-(--ui-text-quaternary)',
            children: 'WorkBots'
          }),
          jsxs('div', {
            className: 'flex items-center gap-0.5',
            children: [
              jsx(Tip, {
                label: activityToasts ? t('roster.toastsOn') : t('roster.toastsOff'),
                children: jsx('button', {
                  type: 'button',
                  className:
                    'flex size-6 items-center justify-center rounded-md text-(--ui-text-tertiary) transition-colors hover:bg-(--chrome-action-hover) hover:text-foreground',
                  onClick: () => setActivityToasts(!activityToasts),
                  children: jsx(Codicon, { name: activityToasts ? 'bell' : 'bell-slash' })
                })
              }),
              // Eye toggle appears only once something is hidden — zero
              // hidden bots means zero extra chrome. It stays visible while
              // hidden rows are revealed, so Unhide is always reachable.
              hiddenBots.length
                ? jsx(Tip, {
                    label: showHidden ? t('roster.hideHiddenAgain') : t('roster.showHiddenCount', hiddenBots.length),
                    children: jsxs('button', {
                      type: 'button',
                      'aria-label': showHidden ? t('roster.hideHidden') : t('roster.showHidden'),
                      className: cn(
                        'relative flex size-6 items-center justify-center rounded-md transition-colors hover:bg-(--chrome-action-hover) hover:text-foreground',
                        showHidden ? 'text-foreground' : 'text-(--ui-text-tertiary)'
                      ),
                      onClick: () => $showHiddenBots.set(!showHidden),
                      children: [
                        jsx(Codicon, { name: showHidden ? 'eye' : 'eye-closed' }),
                        hiddenUnread && !showHidden
                          ? jsx('span', {
                              className:
                                'absolute right-0.5 top-0.5 size-1.5 rounded-full bg-(--ui-accent,#4f9cf9)',
                              'aria-label': t('roster.hiddenUnread')
                            })
                          : null
                      ]
                    })
                  })
                : null,
              jsxs(DropdownMenu, {
                children: [
                  jsx(Tip, {
                    label: t('roster.newMenu'),
                    children: jsx(DropdownMenuTrigger, {
                      asChild: true,
                      children: jsx('button', {
                        type: 'button',
                        'aria-label': t('roster.newMenuLabel'),
                        className:
                          'flex size-6 items-center justify-center rounded-md text-(--ui-text-tertiary) transition-colors hover:bg-(--chrome-action-hover) hover:text-foreground',
                        children: jsx(Codicon, { name: 'add' })
                      })
                    })
                  }),
                  jsxs(DropdownMenuContent, {
                    align: 'end',
                    children: [
                      jsxs(DropdownMenuItem, {
                        onSelect: () => setCreateOpen(true),
                        children: [jsx(Codicon, { name: 'hubot', className: 'mr-1.5' }), t('roster.newAgent')]
                      }),
                      jsxs(DropdownMenuItem, {
                        disabled: activeSourceRoster.length < 2,
                        onSelect: () => setGroupCreateOpen(true),
                        children: [
                          jsx(Codicon, { name: 'organization', className: 'mr-1.5' }),
                          t('roster.newGroupChat')
                        ]
                      })
                    ]
                  })
                ]
              })
            ]
          })
        ]
      }),
      jsx(ActiveNowStrip, {
        roster: visibleRoster,
        activeProfile,
        gatewayState,
        metaByName: allMeta,
        onOpen: bot => {
          const generation = ++botOpenGeneration
          haptic('tap')
          $selectedBot.set(bot.name)

          if (bot.remoteSource) {
            const handle = botHandle(bot.name, bot)
            host.notify?.({
              kind: 'info',
              title: displayName(bot),
              message: t('remote.stayInChat', handle)
            })
            return
          }

          if ($botUnread.get()[bot.name]) {
            const next = { ...$botUnread.get() }
            delete next[bot.name]
            $botUnread.set(next)
          }

          void (async () => {
            let pinnedChat = botRosterMeta(bot, allMeta)?.chat

            try {
              pinnedChat = await prepareBotSource(bot, pinnedChat)
            } catch (error) {
              host.notifyError?.(error, t('remote.reachFailed', bot.connectionLabel || t('remote.remoteSource')))

              return
            }

            if (generation !== botOpenGeneration) {
              return
            }

            try {
              const id = await openBotCanonicalChat(
                bot.name,
                pinnedChat,
                bot.preferred_session || bot.last_session
              )

              if (generation === botOpenGeneration && id) {
                return
              }
            } catch (error) {
              if (generation === botOpenGeneration) {
                host.notifyError?.(error, t('roster.openFailed', displayName(bot)))
              }

              return
            }

            if (generation !== botOpenGeneration) {
              return
            }

            if (typeof host.newChat === 'function') {
              host.newChat(bot.name)
            } else {
              host.navigate('/')
            }
          })()
        }
      }),
      roster.length
        ? jsx('div', {
            className: 'px-2.5 pb-1.5',
            children: jsx(SearchField, {
              'aria-label': t('roster.searchLabel'),
              containerClassName: 'w-full',
              inputClassName: 'w-full',
              placeholder: t('roster.searchBots'),
              value: query,
              onChange: setQuery
            })
          })
        : null,
      staleNotice
        ? jsx('div', {
            className: 'mx-2.5 mb-1 rounded-md bg-(--chrome-action-hover) px-2 py-1.5 text-[0.6875rem] text-(--ui-text-tertiary)',
            children: staleNotice
          })
        : null,
      isLoading && !roster.length
        ? jsx('div', {
            className: 'flex flex-1 items-center justify-center',
            children: jsx(GlyphSpinner, { spinner: 'breathe', className: 'text-(--ui-text-tertiary)' })
          })
        : error && !roster.length
          ? jsxs('div', {
              className: 'grid gap-2 px-3 py-4 text-xs text-(--ui-text-tertiary)',
              children: [
                jsx('div', {
                  children: gatewayUp
                    ? t('roster.unavailable', error instanceof Error ? error.message : t('roster.gatewayError'))
                    : t('roster.waitingConnection')
                }),
                jsx(Button, {
                  variant: 'secondary',
                  size: 'sm',
                  className: 'justify-self-start',
                  onClick: () => void refetch(),
                  children: t('roster.retryNow')
                })
              ]
            })
          : roster.length === 0
            ? jsx(EmptyState, {
                icon: 'hubot',
                title: t('roster.emptyTitle'),
                description: t('roster.emptyDescription')
              })
            : filteredRoster.length === 0 && rosterRows.length === 0
              ? jsx('div', {
                  'aria-live': 'polite',
                  className:
                    'flex flex-1 items-center justify-center px-4 text-center text-xs text-(--ui-text-tertiary)',
                  role: 'status',
                  children: query.trim() ? t('roster.noMatch', query.trim()) : t('roster.allHidden')
                })
              : jsx(ScrollArea, {
                  className: 'work4you-bots-roster min-h-0 flex-1',
                  children: jsx('div', {
                    className: 'grid w-full min-w-0 gap-0.5 px-1.5 pb-2',
                    // Flat, Discord-style list: bot rows and group rows
                    // interleaved by recency — no section headers.
                    children: rosterRows.map(row =>
                      row.kind === 'group'
                        ? jsx(
                            GroupRow,
                            {
                              active: openGroup === row.name,
                              group: row.name,
                              members: row.members,
                              needsYou: Boolean(groupNeedsYou[row.name]),
                              onOpen: openGroupChat
                            },
                            `group:${row.name}`
                          )
                        : jsx(
                            BotRow,
                            { bot: row.bot, onDelete: setDeleting, onEdit: setEditing, onGroup: setGrouping },
                            botRosterKey(row.bot)
                          )
                    )
                  })
                }),
      jsx('div', {
        className: 'border-t border-(--ui-stroke-secondary) p-2',
        children: jsxs(Button, {
          className: 'w-full justify-center gap-1.5',
          variant: 'secondary',
          onClick: () => setCreateOpen(true),
          children: [jsx(Codicon, { name: 'add' }), t('roster.newAgent')]
        })
      }),
      jsx(CreateAgentDialog, {
        open: createOpen,
        onClose: () => {
          setCreateOpen(false)
          void refetch()
        },
        roster: activeSourceRoster
      }),
      jsx(CreateGroupChatDialog, {
        open: groupCreateOpen,
        // Full multi-source roster: group chats can seat bots from other
        // registered connections — their turns route to their own machines.
        roster,
        onClose: () => setGroupCreateOpen(false),
        onCreated: groupName => openGroupChat(groupName)
      }),
      jsx(EditProfileDialog, {
        bot: editing,
        open: Boolean(editing),
        onClose: () => {
          setEditing(null)
          void refetch()
        }
      }),
      grouping ? jsx(GroupDialog, { bot: grouping, onClose: () => setGrouping(null) }) : null,
      jsx(ConfirmDialog, {
        open: Boolean(deleting),
        title: t('roster.deleteDialog.title'),
        description: deleting
          ? jsxs('span', {
              children: [
                t('roster.deleteDialog.bodyStart'),
                jsx('span', { className: 'font-medium text-foreground', children: deleting.name }),
                t('roster.deleteDialog.bodyMiddle'),
                jsx('span', { className: 'font-mono text-xs', children: deleting.path }),
                t('roster.deleteDialog.bodyEnd')
              ]
            })
          : null,
        destructive: true,
        confirmLabel: t('roster.deleteDialog.confirm'),
        busyLabel: t('roster.deleteDialog.busy'),
        doneLabel: t('roster.deleteDialog.done'),
        onClose: () => setDeleting(null),
        onConfirm: async () => {
          if (!deleting) {
            return
          }

          const name = deleting.name
          await deleteBot(deleting)
          await refetch()
          host.notify({ kind: 'success', message: t('roster.deleted', name) })
        }
      })
    ]
  })
}

// ── plugin ───────────────────────────────────────────────────────────────────

export default {
  id: ID,
  name: 'WorkBots',
  description: 'Bot Mode — a one-chat-per-agent roster with avatars, routines, group chats, and bot-to-bot messaging. Ships with the app; disable here if unwanted.',
  register(ctx) {
    // Ship Bot Mode's own copy under the plugin id. Hosts without plugin i18n
    // (older SDKs) skip this, and every translator falls back to English.
    ctx.i18n?.register?.(BOT_MODE_LOCALES)
    pluginCtx = ctx
    // The face clock belongs to the app (src/lib/bot-face-clock.ts): every
    // mounting BotFace wakes it and it parks itself when no face is visible,
    // so there is nothing to start here and nothing to stop on dispose — the
    // sidebar's faces keep breathing when this plugin reloads.

    // @-mention autocomplete: typing "@rese…" in ANY composer offers the
    // roster's handles (issue #88060). Reads the roster straight from the
    // query cache — useRoster keeps it ≤5s stale and the popover must answer
    // synchronously per keystroke. Multi-source rosters contribute their
    // precomputed @name-device handles via botHandle. The active profile is
    // excluded (a bot doesn't @ itself); 'default' surfaces as @work4you.
    ctx.register({
      id: 'mention-completions',
      area: COMPOSER_AREAS.atCompletions,
      data: {
        provide: query => {
          const roster = queryClient.getQueryData(ROSTER_KEY)
          const profiles = Array.isArray(roster?.profiles) ? roster.profiles : []

          if (!profiles.length) {
            return []
          }

          const active = (host.state.profile.get() || 'default').trim() || 'default'
          const q = (query || '').toLowerCase()
          const items = []
          const live = {
            name: active,
            connectionId: String(host.state.connectionId?.get?.() || host.activeConnectionId?.() || 'local')
          }

          for (const profile of profiles) {
            if (!profile?.name || isActiveRosterBot(profile, live)) {
              continue
            }

            const handle = botHandle(profile.name, profile)

            if (q && !handle.toLowerCase().startsWith(q)) {
              continue
            }

            const display = displayName(profile, $botMeta.get()[profile.name])
            const source = profile.connectionLabel ? ` · ${profile.connectionLabel}` : ''

            items.push({
              insert: `@${handle}`,
              display: `@${handle}`,
              meta: tr('mentions.meta', display, source)
            })
          }

          return items.slice(0, 8)
        }
      }
    })

    // Keyframes for the pet bob — injected because plugin classes aren't in
    // the app's precompiled CSS. Idempotent across hot reloads.
    if (!document.getElementById('work4you-bots-keyframes')) {
      const style = document.createElement('style')
      style.id = 'work4you-bots-keyframes'
      style.textContent = '@keyframes work4you-bots-bob { from { transform: translateY(0); } to { transform: translateY(-3px); } }'
      document.head.appendChild(style)
    }

    // Hydrate persisted avatars/titles. Storage may be sync, async, or
    // absent depending on shell version — normalize through Promise.resolve
    // inside a try so a storage quirk can NEVER fail the plugin load.
    try {
      Promise.resolve(ctx.storage?.get?.('bot-meta'))
        .then(value => {
          if (value && typeof value === 'object' && !Array.isArray(value)) {
            const live = $botMeta.get()
            const next = { ...value }
            for (const name of Object.keys(live)) {
              next[name] = { ...(value[name] || {}), ...live[name] }
            }
            $botMeta.set(next)
          }
        })
        .catch(() => undefined)
    } catch {
      /* no storage on this shell — defaults stay */
    }

    // Bot Mode sessions are always hidden now — the old "hide Bot Chats"
    // pref is gone (its stored key is simply ignored). The reconciliation
    // sweep below hides any rows born visible under the old pref.

    // Hydrate the activity-toast pref (default OFF).
    try {
      Promise.resolve(ctx.storage?.get?.('activity-toasts'))
        .then(value => {
          if (typeof value === 'boolean') {
            $activityToasts.set(value)
          }
        })
        .catch(() => undefined)
    } catch {
      /* no storage — default (silent) stays */
    }

    // Hydrate persisted group-chat room logs (epoch/running are runtime-only
    // and always reset — a loop can't survive a window reload anyway).
    try {
      Promise.resolve(ctx.storage?.get?.('group-chats'))
        .then(value => {
          if (value && typeof value === 'object' && !Array.isArray(value)) {
            const rooms = {}

            for (const [name, room] of Object.entries(value)) {
              if (room && Array.isArray(room.log)) {
                rooms[name] = {
                  // Pre-thread entries get synthetic thread ids on hydrate so
                  // every UI/engine path can assume entry.thread exists.
                  log: assignLegacyThreads(room.log),
                  watermarks: room.watermarks && typeof room.watermarks === 'object' ? room.watermarks : {},
                  sessions: room.sessions && typeof room.sessions === 'object' ? room.sessions : {},
                  stranded: room.stranded && typeof room.stranded === 'object' ? room.stranded : {},
                  members: Array.isArray(room.members) ? room.members : [],
                  image: typeof room.image === 'string' && room.image ? room.image : null,
                  epoch: 0,
                  running: false
                }
              }
            }

            $groupChats.set({ ...rooms, ...$groupChats.get() })
          }
        })
        .catch(() => undefined)
    } catch {
      /* no storage — rooms start empty */
    }

    // The group room page: a group's conversation opens in the center, where
    // a bot's chat renders, beside the unchanged roster.
    if (ROUTES_AREA && typeof host.navigate === 'function') {
      ctx.register({
        id: 'group-room',
        area: ROUTES_AREA,
        title: 'WorkBots',
        data: { path: GROUP_ROOM_PATH },
        render: () => jsx(GroupChatMainView, {})
      })
      groupRoomPageRegistered = true

      // Reselect the last open room: the app restores its last route on
      // launch, and that may be this page.
      try {
        Promise.resolve(ctx.storage?.get?.('open-group'))
          .then(value => {
            if (typeof value === 'string' && value && $groupChatWorkspace.get() === null) {
              $groupChatWorkspace.set(value)
            }
          })
          .catch(() => undefined)
      } catch {
        /* no storage — the page shows its empty state until a room is picked */
      }
    }

    // Routines follow the chat you're in: track the focused chat's owner
    // profile (falls back to the live gateway profile on older desktops —
    // see $focusedBotProfile). Keying this off the socket's home alone left
    // the unread-suppression and Routines scope on the wrong bot whenever a
    // focused tab showed another profile's chat.
    // Capture the unbinds: without them a disable → re-enable cycle stacks a
    // duplicate listener per cycle (same survives-disable class as the face
    // clock before its onDispose hook — these kept firing until app restart).
    const unbindProfileListener = bindProfileSync($focusedBotProfile)
    const unbindGatewayListener = host.state.gateway.listen(handleSessionsGatewayTransition)

    if (typeof ctx.onDispose === 'function') {
      ctx.onDispose(() => {
        if (typeof unbindProfileListener === 'function') {
          unbindProfileListener()
        }
        if (typeof unbindGatewayListener === 'function') {
          unbindGatewayListener()
        }
      })
    }

    // Reconciliation sweep: hide every Bot Mode session we know about, on
    // load and again on each reconnect (a swap can land on a gateway whose
    // rows were created before the always-hidden policy). Deferred a tick so
    // the meta/room storage hydrates above have landed; idempotent after that.
    // (Feature-guarded: bare vm test harnesses have no setTimeout global.)
    const scheduleHideSweep = () => {
      try {
        setTimeout(() => void hideOwnedBotSessions(), 0)
      } catch {
        void hideOwnedBotSessions()
      }
    }
    host.state.gateway.listen(state => {
      if (state === 'open') {
        scheduleHideSweep()
      }
    })
    scheduleHideSweep()

    ctx.register({
      id: 'pane',
      area: 'panes',
      title: 'WorkBots',
      // dock: explicit adoption gesture — CENTER-STACK into the sessions zone
      // so the sidebar grows a SESSIONS | BOTS tab strip instead of splitting
      // two cramped panes down the column. Center is safe now: insertAtGroup
      // pins the zone's header explicitly shown on a center gain (and it
      // stays shown once the zone has stacked), so the sessions pane can
      // never vanish behind a stripless Bots tab — the lone-pane auto-hide
      // trap this dock used to work around with a 'bottom' split.
      // enforce: standing invariant, not a one-shot migration — the pane
      // re-homes into the sessions strip at EVERY boot it isn't already
      // there, whatever tokens or user placement an older install persisted.
      // The one-time heal ('sessions-tab-v1') burned its token even when its
      // guards skipped the move, so exactly the users who had fought the old
      // stacked layout (dragged panes → $userPlacedPanes) stayed stacked
      // forever. Owner's order: SESSIONS | BOTS is always a tab strip.
      // An intra-session drag still sticks until the next launch (the
      // invariant runs at adoption time only — see enforceDockedPanes in the
      // tree store).
      // collapsible: the pane lives in the sessions zone, so it must LEAVE
      // the grid with that zone below the sidebar-collapse breakpoint. The
      // sessions pane collapses alone without this flag. The zone then keeps
      // a stranded BOTS tab on screen. The narrow edge overlay mirrors the
      // zone's tab strip, so the pane stays reachable while collapsed.
      data: { placement: 'left', width: '260px', collapsible: true, showCloseButton: false, hideOnly: true, dock: { pane: 'sessions', pos: 'center', enforce: true } },
      render: () => jsx(BotsPane, {})
    })

    // Routines — its OWN tiling pane splitting the workspace's right edge
    // (NOT the collapsible right sidebar; placement 'right' is that sidebar's
    // role and hides the pane until "Show Right Sidebar").
    //
    // Registered ONLY while Bot Mode is on screen: the pane exists while the
    // Bots pane is visible (its zone's active tab, or a lone pane in a
    // stacked pre-heal layout) and unregisters when the user tabs back to
    // Sessions — no Cronjobs tile squatting beside the chat outside Bot Mode.
    // `ctx.register` returns the disposer that makes this cheap; the tree
    // keeps the pane's spot, so re-registering re-adopts it where it was.
    // host.paneVisibility is feature-detected: older desktops without the SDK
    // export keep the always-registered behavior.
    const registerRoutinesPane = () =>
      ctx.register({
        id: 'routines',
        area: 'panes',
        title: tr('routines.paneTitle'),
        data: {
          placement: 'main',
          // Repair persisted layouts that stranded Cronjobs in the Bots tab strip.
          dock: { pane: 'workspace', pos: 'right', enforce: true },
          width: '250px',
          // `title` above is read once at registration; the tab label itself
          // follows later language switches through this live renderer.
          tabTitle: () => jsx(RoutinesPaneTitle, {})
        },
        render: () => jsx(RoutinesPane, {})
      })

    if (typeof host.paneVisibility === 'function') {
      // The contribution-scoped pane id (`register` prefixes `${ID}:`).
      const $botsPaneVisible = host.paneVisibility(`${ID}:pane`)
      let unregisterRoutines = null

      const syncRoutinesPane = visible => {
        if (visible) {
          unregisterRoutines ??= registerRoutinesPane()
        } else if (unregisterRoutines) {
          unregisterRoutines()
          unregisterRoutines = null
        }
      }

      const stopRoutinesSync = $botsPaneVisible.listen(syncRoutinesPane)
      syncRoutinesPane($botsPaneVisible.get())

      if (typeof ctx.onDispose === 'function') {
        // The registration disposer is already tracked by ctx.register; only
        // the listener needs explicit teardown or it survives plugin disable.
        ctx.onDispose(stopRoutinesSync)
      }
    } else {
      registerRoutinesPane()
    }

    ctx.register({
      id: 'new-agent',
      area: PALETTE_AREA,
      data: {
        id: `${ID}.new-agent`,
        // Getter: the palette re-reads it on open, so it follows the language.
        get label() {
          return tr('palette.newAgent')
        },
        keywords: ['bot', 'agent', 'profile', 'teammate', 'create'],
        run: () => {
          host.notify({ kind: 'info', message: tr('palette.newAgentHint') })
        }
      }
    })

    // @-mention middleware: "@<bot> do the thing" in any chat becomes an
    // explicit handoff instruction the active agent's SOUL.md knows how to
    // execute. Names are validated against the LIVE roster so
    // "user@example.com" or an unknown @ passes through untouched.
    ctx.register({
      id: 'mention-middleware',
      area: COMPOSER_AREAS.middleware,
      data: {
        handler: async draft => {
          const text = draft.text || ''

          // /new inside a bot's canonical forever-chat would fork the
          // relationship into a scratch session — the one thing Bots mode
          // promises never happens. Reroute to /compact (same felt effect:
          // fresh working context, SAME conversation) and say so. Only
          // guards the canonical chat: Sessions-mode scratchpads on the
          // same profile keep full /new freedom.
          const slashNew = /^\/(new|reset)\s*$/.exec(text.trim())

          if (slashNew) {
            const activeBot = $selectedBot.get()
            const meta = activeBot ? $botMeta.get()[activeBot] : null
            const pinnedId = meta?.chat || null
            const currentId = host.activeSessionId?.get?.() ?? null

            if (activeBot && pinnedId && currentId && String(currentId) === String(pinnedId)) {
              host.notify({
                kind: 'info',
                title: tr('guard.title'),
                message: tr('guard.message')
              })

              return { ...draft, text: '/compact' }
            }
          }

          if (!/(^|\s)@[a-z0-9][a-z0-9_-]*/i.test(text)) {
            return draft
          }

          const live = {
            name: (host.state.profile.get() || 'default').trim() || 'default',
            connectionId: String(host.state.connectionId?.get?.() || host.activeConnectionId?.() || 'local')
          }
          const cached = typeof queryClient !== 'undefined' && queryClient && typeof queryClient.getQueryData === 'function'
            ? queryClient.getQueryData(ROSTER_KEY)
            : null
          const roster = Array.isArray(cached?.profiles) ? cached.profiles : null
          let mentionedBots = roster ? resolveRosterMentions(text, roster, live) : []

          if (!roster) {
            let names = []
            try {
              const res = await host.request('profiles.list', { include_sessions: false })
              names = (res?.profiles ?? []).map(p => p.name)
            } catch {
              return draft
            }

            const prose = text.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`\n]*`/g, ' ')
            const mentioned = []

            for (const match of prose.matchAll(/(^|\s)@([a-z0-9][a-z0-9_-]*)/gi)) {
              let name = match[2].toLowerCase()

              if (name === 'work4you' && !names.includes('work4you') && names.includes('default')) {
                name = 'default'
              }

              if (names.includes(name) && name !== live.name && !mentioned.includes(name)) {
                mentioned.push(name)
              }
            }

            mentionedBots = mentioned.map(name => ({ name }))
          }

          if (!mentionedBots.length) {
            return draft
          }

          const localMentions = mentionedBots.filter(bot => !bot.remoteSource)
          const remoteMentions = mentionedBots.filter(bot => bot.remoteSource)

          const activeMeta = $botMeta.get()[live.name]
          const senderName = displayName({ name: live.name, title: activeMeta?.title }, activeMeta)

          if (remoteMentions.length && typeof host.requestProfile === 'function') {
            void deliverRemoteRosterMentions(remoteMentions, text, {
              name: senderName,
              handle: botHandle(live.name)
            })
          }
          let note = ''

          if (localMentions.length) {
            note +=
              '\n\n[@mention handoff — for each mentioned agent (' + localMentions.map(bot => botHandle(bot.name, bot)).join(', ') + '): ' +
              'COMPOSE a message from you (' + senderName + ') to that agent conveying what the user wants — do not forward this text verbatim (avoid double quotes in your composed message). Send it with exactly one terminal call, run with background=true AND notify_on_complete=true (the recipient may take minutes; the user must not be blocked):\n' +
              localMentions.map(bot => '`work4you -p ' + shellQuote(bot.name) + ' chat --in ~ -c "Bot Chat" --create-if-missing -Q -q "Message from 🤖 ' + shellDoubleQuote(senderName) + ' (@' + shellDoubleQuote(botHandle(live.name)) + '): <your composed message>"`').join('\n') +
              '\nAfter dispatching, tell the user the message was sent and END YOUR TURN — do not wait or poll; when the background process completes, its notification carries the reply — relay it then, attributed to that agent. ' +
              'Relay the reply back to the user, attributed to that agent.]'
          }

          if (remoteMentions.length) {
            const labels = remoteMentions.map(bot => `@${botHandle(bot.name, bot)} (${bot.connectionLabel || bot.connectionId})`).join(', ')
            note +=
              '\n\n[@mention — stay on this device. Desktop is delivering to ' + labels +
              ' over Connections in the background. Do not run work4you -p for them and do not switch Gateway. Tell the user they were messaged here; when a reply lands, relay it attributed to that agent.]'
          }

          return { ...draft, text: text + note }
        }      }
    })
  }
}
