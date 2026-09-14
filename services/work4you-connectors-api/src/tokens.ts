import { randomBytes } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export type McpTokenRecord = {
  token: string
  sub: string
  entityId: string
  sessionId: string
  composioMcpUrl: string
  createdAt: number
  /** Allowlisted toolkit slugs this entity connected in its own HOME. */
  connectedSlugs: string[]
  /** Composio connected-account ids keyed by toolkit slug (this entity only). */
  accountIds: Record<string, string>
}

export type TokenStoreInherit = {
  connectedSlugs?: string[]
  accountIds?: Record<string, string>
}

function slugKey(slug: string): string {
  return slug.trim().toLowerCase()
}

function parseSlugList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    const slug = String(item ?? '').trim()
    if (!slug) continue
    const key = slugKey(slug)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(slug)
  }
  return out
}

function parseAccountIds(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, string> = {}
  for (const [slug, value] of Object.entries(raw as Record<string, unknown>)) {
    const key = slugKey(slug)
    const id = String(value ?? '').trim()
    if (!key || !id) continue
    out[key] = id
  }
  return out
}

function copyAccountIds(
  ids: Record<string, string>,
  slugs: readonly string[],
): Record<string, string> {
  const keep = new Set(slugs.map(slugKey))
  const out: Record<string, string> = {}
  for (const [slug, id] of Object.entries(ids)) {
    if (keep.has(slugKey(slug))) out[slugKey(slug)] = id
  }
  return out
}

export class TokenStore {
  private byToken = new Map<string, McpTokenRecord>()
  private byEntityId = new Map<string, string>()
  private persistPath: string | null

  constructor(persistPath?: string | null) {
    const path = typeof persistPath === 'string' ? persistPath.trim() : ''
    this.persistPath = path || null
    this.loadFromDisk()
  }

  issue(
    entityId: string,
    sessionId: string,
    composioMcpUrl: string,
    sub: string,
    inherit?: TokenStoreInherit,
  ): McpTokenRecord {
    const existingId = this.byEntityId.get(entityId)
    const previous = existingId ? this.byToken.get(existingId) : undefined
    if (existingId) this.byToken.delete(existingId)
    const token = `w4y-c-${randomBytes(24).toString('hex')}`
    const connectedSlugs = parseSlugList(
      inherit?.connectedSlugs ?? previous?.connectedSlugs,
    )
    const accountIds = copyAccountIds(
      inherit?.accountIds ?? previous?.accountIds ?? {},
      connectedSlugs,
    )
    const record: McpTokenRecord = {
      token,
      sub,
      entityId,
      sessionId,
      composioMcpUrl,
      createdAt: Date.now(),
      connectedSlugs,
      accountIds,
    }
    this.byToken.set(token, record)
    this.byEntityId.set(entityId, token)
    this.persistToDisk()
    return record
  }

  get(token: string): McpTokenRecord | undefined {
    return this.byToken.get(token)
  }

  getByEntityId(entityId: string): McpTokenRecord | undefined {
    const token = this.byEntityId.get(entityId)
    return token ? this.byToken.get(token) : undefined
  }

  revokeByEntityId(entityId: string): void {
    const token = this.byEntityId.get(entityId)
    if (token) this.byToken.delete(token)
    this.byEntityId.delete(entityId)
    this.persistToDisk()
  }

  replaceConnectedSlugs(entityId: string, slugs: readonly string[]): void {
    const record = this.getByEntityId(entityId)
    if (!record) return
    record.connectedSlugs = parseSlugList(slugs)
    record.accountIds = copyAccountIds(record.accountIds, record.connectedSlugs)
    this.persistToDisk()
  }

  stampApp(entityId: string, slug: string, accountId: string | null): boolean {
    const record = this.getByEntityId(entityId)
    if (!record) return false
    const key = slugKey(slug)
    if (!key) return false
    if (!record.connectedSlugs.some((item) => slugKey(item) === key)) {
      record.connectedSlugs = [...record.connectedSlugs, slug.trim()]
    }
    const id = (accountId ?? '').trim()
    if (id) {
      record.accountIds = { ...record.accountIds, [key]: id }
    }
    this.persistToDisk()
    return true
  }

  unstampApp(entityId: string, slug: string): string | undefined {
    const record = this.getByEntityId(entityId)
    if (!record) return undefined
    const key = slugKey(slug)
    const accountId = record.accountIds[key]
    record.connectedSlugs = record.connectedSlugs.filter((item) => slugKey(item) !== key)
    const { [key]: _dropped, ...rest } = record.accountIds
    record.accountIds = rest
    this.persistToDisk()
    return accountId
  }

  private loadFromDisk(): void {
    if (!this.persistPath) return
    let raw: string
    try {
      raw = readFileSync(this.persistPath, 'utf8')
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('[work4you-connectors-api] failed to read token store', err)
      }
      return
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch (err) {
      console.error('[work4you-connectors-api] token store is not valid JSON', err)
      return
    }
    const rows = Array.isArray(parsed) ? parsed : []
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue
      const rec = row as Record<string, unknown>
      const token = typeof rec.token === 'string' ? rec.token : ''
      const sub = typeof rec.sub === 'string' ? rec.sub : ''
      const entityId = typeof rec.entityId === 'string' ? rec.entityId : ''
      const sessionId = typeof rec.sessionId === 'string' ? rec.sessionId : ''
      const composioMcpUrl = typeof rec.composioMcpUrl === 'string' ? rec.composioMcpUrl : ''
      const createdAt = typeof rec.createdAt === 'number' ? rec.createdAt : Date.now()
      // Pre-isolation rows keyed only by person `sub` are skipped — no
      // grandfathering. Those homes re-bootstrap into sub::{profile}.
      if (!token.startsWith('w4y-c-') || !sub || !entityId || !sessionId || !composioMcpUrl) continue
      const connectedSlugs = parseSlugList(rec.connectedSlugs)
      const record: McpTokenRecord = {
        token,
        sub,
        entityId,
        sessionId,
        composioMcpUrl,
        createdAt,
        connectedSlugs,
        accountIds: copyAccountIds(parseAccountIds(rec.accountIds), connectedSlugs),
      }
      this.byToken.set(token, record)
      this.byEntityId.set(entityId, token)
    }
  }

  private persistToDisk(): void {
    if (!this.persistPath) return
    const rows = [...this.byToken.values()]
    const tmp = `${this.persistPath}.${process.pid}.tmp`
    try {
      mkdirSync(dirname(this.persistPath), { recursive: true })
      writeFileSync(tmp, JSON.stringify(rows), { encoding: 'utf8', mode: 0o600 })
      renameSync(tmp, this.persistPath)
    } catch (err) {
      console.error('[work4you-connectors-api] failed to persist token store', err)
      try {
        unlinkSync(tmp)
      } catch {
        // ignore cleanup failure
      }
    }
  }
}
