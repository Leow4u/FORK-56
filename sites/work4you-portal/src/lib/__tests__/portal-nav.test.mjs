import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PORTAL_ACCOUNT_NAV,
  PORTAL_WORKSPACE_NAV,
  navPath,
} from '../portal-nav.ts'

test('navPath builds org routes', () => {
  assert.equal(navPath('abc123', ''), '/orgs/abc123')
  assert.equal(navPath('abc123', 'billing'), '/orgs/abc123/billing')
})

test('workspace nav leads with agent home', () => {
  assert.equal(PORTAL_WORKSPACE_NAV[0]?.segment, '')
  assert.equal(PORTAL_WORKSPACE_NAV[0]?.id, 'agent')
})

test('account nav excludes duplicate agent entry', () => {
  const workspaceIds = new Set(PORTAL_WORKSPACE_NAV.map((i) => i.id))
  for (const item of PORTAL_ACCOUNT_NAV) {
    assert.equal(workspaceIds.has(item.id), false)
  }
})
