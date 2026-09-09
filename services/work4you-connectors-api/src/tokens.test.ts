import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { TokenStore } from './tokens.js'

test('TokenStore stays in-memory when no persist path is set', () => {
  const store = new TokenStore()
  const issued = store.issue('user-a', 'sess-1', 'https://mcp.example/a')
  assert.equal(store.get(issued.token)?.sub, 'user-a')
  const other = new TokenStore()
  assert.equal(other.get(issued.token), undefined)
})

test('TokenStore round-trips records through a persist file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'w4y-tokens-'))
  const path = join(dir, 'mcp-tokens.json')
  const store = new TokenStore(path)
  const issued = store.issue('user-a', 'sess-1', 'https://mcp.example/a')
  store.issue('user-b', 'sess-2', 'https://mcp.example/b')

  const dumped = JSON.parse(readFileSync(path, 'utf8')) as Array<{ sub: string }>
  assert.equal(dumped.length, 2)

  const reloaded = new TokenStore(path)
  const restored = reloaded.get(issued.token)
  assert.equal(restored?.sub, 'user-a')
  assert.equal(restored?.sessionId, 'sess-1')
  assert.equal(restored?.composioMcpUrl, 'https://mcp.example/a')
  assert.equal(reloaded.getBySub('user-b')?.sessionId, 'sess-2')
})

test('TokenStore issue for the same sub replaces the previous token on disk', () => {
  const dir = mkdtempSync(join(tmpdir(), 'w4y-tokens-'))
  const path = join(dir, 'mcp-tokens.json')
  const store = new TokenStore(path)
  const first = store.issue('user-a', 'sess-1', 'https://mcp.example/a')
  const second = store.issue('user-a', 'sess-2', 'https://mcp.example/a2')
  assert.notEqual(first.token, second.token)

  const reloaded = new TokenStore(path)
  assert.equal(reloaded.get(first.token), undefined)
  assert.equal(reloaded.get(second.token)?.sessionId, 'sess-2')
})

test('TokenStore revokeBySub drops the record from disk', () => {
  const dir = mkdtempSync(join(tmpdir(), 'w4y-tokens-'))
  const path = join(dir, 'mcp-tokens.json')
  const store = new TokenStore(path)
  store.issue('user-a', 'sess-1', 'https://mcp.example/a')
  store.revokeBySub('user-a')

  const reloaded = new TokenStore(path)
  assert.equal(reloaded.getBySub('user-a'), undefined)
})
