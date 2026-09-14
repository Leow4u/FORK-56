import { randomBytes } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export type McpTokenRecord = {
  token: string
  sub: string
  sessionId: string
  composioMcpUrl: string
  createdAt: number
}

export class TokenStore {
  private byToken = new Map<string, McpTokenRecord>()
  private bySub = new Map<string, string>()
  private persistPath: string | null

  constructor(persistPath?: string | null) {
    const path = typeof persistPath === 'string' ? persistPath.trim() : ''
    this.persistPath = path || null
    this.loadFromDisk()
  }

  issue(sub: string, sessionId: string, composioMcpUrl: string): McpTokenRecord {
    const existingId = this.bySub.get(sub)
    if (existingId) this.byToken.delete(existingId)
    const token = `w4y-c-${randomBytes(24).toString('hex')}`
    const record: McpTokenRecord = {
      token,
      sub,
      sessionId,
      composioMcpUrl,
      createdAt: Date.now(),
    }
    this.byToken.set(token, record)
    this.bySub.set(sub, token)
    this.persistToDisk()
    return record
  }

  get(token: string): McpTokenRecord | undefined {
    return this.byToken.get(token)
  }

  getBySub(sub: string): McpTokenRecord | undefined {
    const token = this.bySub.get(sub)
    return token ? this.byToken.get(token) : undefined
  }

  revokeBySub(sub: string): void {
    const token = this.bySub.get(sub)
    if (token) this.byToken.delete(token)
    this.bySub.delete(sub)
    this.persistToDisk()
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
      const sessionId = typeof rec.sessionId === 'string' ? rec.sessionId : ''
      const composioMcpUrl = typeof rec.composioMcpUrl === 'string' ? rec.composioMcpUrl : ''
      const createdAt = typeof rec.createdAt === 'number' ? rec.createdAt : Date.now()
      if (!token.startsWith('w4y-c-') || !sub || !sessionId || !composioMcpUrl) continue
      const record: McpTokenRecord = { token, sub, sessionId, composioMcpUrl, createdAt }
      this.byToken.set(token, record)
      this.bySub.set(sub, token)
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
