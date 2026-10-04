import { atom } from 'nanostores'

import type { MessagingPlatformInfo, PairingUser } from '@/types/work4you'

import type { CapabilitiesView } from '../skills/store'

import type { ChannelKind } from './channel-kinds'

export interface ChannelsSnapshot {
  pairing: { approved: PairingUser[]; pending: PairingUser[] }
  platforms: MessagingPlatformInfo[]
}

/** The last channel list and pairing feed the page showed, per settings
 *  scope (profile key, '' for the primary). Revisiting Channels paints these
 *  rows at once and refreshes behind them — the list is built server-side
 *  on every call, and a blank loader on each visit read as the page being
 *  broken. Rows here are only ever a scope's own, so acting on one is the
 *  same as acting on it a refresh later. */
export const $channelsSnapshots = atom<Record<string, ChannelsSnapshot>>({})

export function readChannelsSnapshot(scopeKey: string): ChannelsSnapshot | null {
  return $channelsSnapshots.get()[scopeKey] ?? null
}

export function writeChannelsSnapshot(scopeKey: string, snapshot: ChannelsSnapshot): void {
  $channelsSnapshots.set({ ...$channelsSnapshots.get(), [scopeKey]: snapshot })
}

/** Which half of Channels is showing: Connected (the channels that are turned
 *  on, as a table) or Discover (the rest, as cards) — the MCP tab's switch.
 *  `null` until the user picks: the page then opens on Connected when any
 *  channel is on, else on Discover, so a fresh profile lands on the cards.
 *  The pick lives for the app session, like the Capabilities views. */
export const $channelsView = atom<CapabilitiesView | null>(null)

/** The Category filter of Channels: every channel, or only the ones of one
 *  kind (Conversation / Integrations). Lives for the app session like the
 *  view, so opening a channel and coming back keeps it. */
export const $channelsCategory = atom<'all' | ChannelKind>('all')
