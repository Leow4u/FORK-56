import { atom } from 'nanostores'

export type PluginKind = 'bundled' | 'disk' | 'runtime'
export type PluginStatus = 'disabled' | 'error' | 'loaded'

export interface PluginRecord {
  id: string
  name: string
  kind: PluginKind
  status: PluginStatus
  description?: string
  error?: string
  file?: string
}

export const $plugins = atom<readonly PluginRecord[]>([])

export function setPluginEnabled(_id: string, _enabled: boolean): void {
  // Web dashboard has no desktop plugin host yet.
}
