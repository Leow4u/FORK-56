import { atom } from 'nanostores'

import { Codecs, persistentAtom } from '@/lib/persisted'

// Per-view sort direction for the Capabilities lists — persisted so each tab
// remembers most/least-used across navigations and restarts.
export const $skillsSortDesc = persistentAtom('work4you.desktop.capabilities.skillsSortDesc', true, Codecs.bool)
export const $toolsetsSortDesc = persistentAtom('work4you.desktop.capabilities.toolsetsSortDesc', true, Codecs.bool)

// Per-tab "mine | discover" switch and category filter for the Capabilities
// toolbar. Session state on purpose (not persisted): a fresh launch starts on
// each tab's default view. MCP opens on Discover — its Connected list is empty
// until something is connected — while Skills and Plugins open on what is
// installed.
export type CapabilitiesView = 'mine' | 'discover'

export const $skillsView = atom<CapabilitiesView>('mine')
export const $mcpView = atom<CapabilitiesView>('discover')
export const $pluginsView = atom<CapabilitiesView>('mine')

/** Category filter per tab — `'all'` or a category id the tab defines. */
export const $skillsCategory = atom<string>('all')
export const $mcpCategory = atom<string>('all')
export const $pluginsCategory = atom<string>('all')
