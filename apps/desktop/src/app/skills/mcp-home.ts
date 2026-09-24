const ACCOUNT_NAMES = new Set(['gmail', 'googledrive', 'work4you_apps'])
const APPS_TOKEN_ENV = 'WORK4YOU_APPS_MCP_TOKEN'
const STORAGE_KEY = 'work4you.account-mcp'

export interface AccountMcpEntry {
  auth?: string
  command?: string
  name: string
  url?: string
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** A local process. HTTP, Gmail, Drive, and the apps broker are the person's. */
export function mcpIsDeviceServer(name: string, entry: { command?: unknown; url?: unknown }): boolean {
  if (ACCOUNT_NAMES.has(name.trim().toLowerCase())) {
    return false
  }

  return Boolean(text(entry.command)) && !text(entry.url)
}

export function accountMcpEntries(
  servers: Record<string, { auth?: unknown; command?: unknown; url?: unknown }>
): AccountMcpEntry[] {
  return Object.entries(servers)
    .filter(([name, entry]) => !mcpIsDeviceServer(name, entry) && (ACCOUNT_NAMES.has(name.toLowerCase()) || text(entry.url)))
    .map(([name, entry]) => ({
      auth: text(entry.auth) || undefined,
      command: text(entry.command) || undefined,
      name,
      url: text(entry.url) || undefined
    }))
}

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

export function readAccountMcp(): AccountMcpEntry[] {
  const raw = storage()?.getItem(STORAGE_KEY)

  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw) as AccountMcpEntry[]

    return Array.isArray(parsed) ? parsed.filter(entry => entry && typeof entry.name === 'string') : []
  } catch {
    return []
  }
}

export function rememberAccountMcp(entries: AccountMcpEntry[]): void {
  const byName = new Map(readAccountMcp().map(entry => [entry.name, entry]))

  for (const entry of entries) {
    byName.set(entry.name, entry)
  }

  storage()?.setItem(STORAGE_KEY, JSON.stringify([...byName.values()]))
}

/** Account servers this connection does not have yet. */
export function accountMcpToInstall(
  present: Record<string, unknown>,
  catalog: AccountMcpEntry[]
): AccountMcpEntry[] {
  return catalog.filter(entry => !(entry.name in present))
}

export const accountMcpTokenEnv = APPS_TOKEN_ENV
