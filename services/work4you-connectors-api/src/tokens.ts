import { randomBytes } from 'node:crypto'

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
  }
}
