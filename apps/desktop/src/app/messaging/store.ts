import { atom } from 'nanostores'

import type { CapabilitiesView } from '../skills/store'

/** Which half of Channels is showing: Connected (the channels that are turned
 *  on, as a table) or Discover (the rest, as cards) — the MCP tab's switch.
 *  `null` until the user picks: the page then opens on Connected when any
 *  channel is on, else on Discover, so a fresh profile lands on the cards.
 *  The pick lives for the app session, like the Capabilities views. */
export const $channelsView = atom<CapabilitiesView | null>(null)
