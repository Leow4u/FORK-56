import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { TokenStore } from './tokens.js'

test('TokenStore stays in-memory when no persist path is set', () => {
  const store = new TokenStore()
  const issued = store.issue('user-a::default', 'sess-1', 'https://mcp.example/a', 'user-a')
  assert.equal(store.get(issued.token)?.sub, 'user-a')
  assert.equal(store.get(issued.token)?.entityId, 'user-a::default')
  const other = new TokenStore()
  assert.equal(other.get(issued.token), undefined)
})

test('TokenStore round-trips records through a persist file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'w4y-tokens-'))
  const path = join(dir, 'mcp-tokens.json')
  const store = new TokenStore(path)
  const issued = store.issue('user-a::default', 'sess-1', 'https://mcp.example/a', 'user-a')
  store.issue('user-b::default', 'sess-2', 'https://mcp.example/b', 'user-b')

  const dumped = JSON.parse(readFileSync(path, 'utf8')) as Array<{ sub: string; entityId: string }>
  assert.equal(dumped.length, 2)
  assert.ok(dumped.every((row) => typeof row.entityId === 'string' && row.entityId.includes('::')))

  const reloaded = new TokenStore(path)
  const restored = reloaded.get(issued.token)
  assert.equal(restored?.sub, 'user-a')
  assert.equal(restored?.entityId, 'user-a::default')
  assert.equal(restored?.sessionId, 'sess-1')
  assert.equal(restored?.composioMcpUrl, 'https://mcp.example/a')
  assert.equal(reloaded.getByEntityId('user-b::default')?.sessionId, 'sess-2')
})

test('TokenStore issue for the same entityId replaces the previous token on disk', () => {
  const dir = mkdtempSync(join(tmpdir(), 'w4y-tokens-'))
  const path = join(dir, 'mcp-tokens.json')
  const store = new TokenStore(path)
  const first = store.issue('user-a::default', 'sess-1', 'https://mcp.example/a', 'user-a')
  const second = store.issue('user-a::default', 'sess-2', 'https://mcp.example/a2', 'user-a')
  assert.notEqual(first.token, second.token)

  const reloaded = new TokenStore(path)
  assert.equal(reloaded.get(first.token), undefined)
  assert.equal(reloaded.get(second.token)?.sessionId, 'sess-2')
  assert.equal(reloaded.getByEntityId('user-a::default')?.token, second.token)
})

test('TokenStore issue for the same sub and different entityIds keeps both tokens', () => {
  const dir = mkdtempSync(join(tmpdir(), 'w4y-tokens-'))
  const path = join(dir, 'mcp-tokens.json')
  const store = new TokenStore(path)
  const defaultHome = store.issue('user-a::default', 'sess-default', 'https://mcp.example/a', 'user-a')
  const leo = store.issue('user-a::leo', 'sess-leo', 'https://mcp.example/leo', 'user-a')
  assert.notEqual(defaultHome.token, leo.token)
  assert.equal(store.get(defaultHome.token)?.sessionId, 'sess-default')
  assert.equal(store.get(leo.token)?.sessionId, 'sess-leo')

  const reloaded = new TokenStore(path)
  assert.equal(reloaded.get(defaultHome.token)?.entityId, 'user-a::default')
  assert.equal(reloaded.get(leo.token)?.entityId, 'user-a::leo')
  assert.equal(reloaded.getByEntityId('user-a::default')?.token, defaultHome.token)
  assert.equal(reloaded.getByEntityId('user-a::leo')?.token, leo.token)
})

test('TokenStore revokeByEntityId drops the record from disk', () => {
  const dir = mkdtempSync(join(tmpdir(), 'w4y-tokens-'))
  const path = join(dir, 'mcp-tokens.json')
  const store = new TokenStore(path)
  store.issue('user-a::default', 'sess-1', 'https://mcp.example/a', 'user-a')
  store.revokeByEntityId('user-a::default')

  const reloaded = new TokenStore(path)
  assert.equal(reloaded.getByEntityId('user-a::default'), undefined)
})

test('TokenStore skips persisted rows without entityId', () => {
  const dir = mkdtempSync(join(tmpdir(), 'w4y-tokens-'))
  const path = join(dir, 'mcp-tokens.json')
  writeFileSync(
    path,
    JSON.stringify([
      {
        token: `w4y-c-${'ab'.repeat(24)}`,
        sub: 'user-a',
        sessionId: 'sess-old',
        composioMcpUrl: 'https://mcp.example/a',
        createdAt: Date.now(),
      },
    ]),
  )
  const store = new TokenStore(path)
  assert.equal(store.get(`w4y-c-${'ab'.repeat(24)}`), undefined)
  assert.equal(store.getByEntityId('user-a'), undefined)
  assert.equal(store.getByEntityId('user-a::default'), undefined)
})
