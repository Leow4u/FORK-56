import assert from 'node:assert/strict'
import test from 'node:test'

import {
  oauthAuthorizeQuery,
  oauthAuthorizeQueryValid,
  shouldAutoApproveAgentLink
} from '../oauth-authorize.ts'

const params = new URLSearchParams({
  client_id: 'agent:cmtkfal3b0001jr04lizoah4r',
  code_challenge: 'challenge',
  redirect_uri: 'https://agent.example/auth/callback',
  response_type: 'code',
  state: 'state'
})

test('a signed-in agent OAuth request auto-approves once', () => {
  const query = oauthAuthorizeQuery(params)

  assert.equal(oauthAuthorizeQueryValid(query), true)
  assert.equal(
    shouldAutoApproveAgentLink({ attempted: false, authenticated: true, ready: true, valid: true }),
    true
  )
  assert.equal(
    shouldAutoApproveAgentLink({ attempted: true, authenticated: true, ready: true, valid: true }),
    false
  )
})

test('a signed-out or incomplete request waits', () => {
  assert.equal(
    shouldAutoApproveAgentLink({ attempted: false, authenticated: false, ready: true, valid: true }),
    false
  )
  assert.equal(oauthAuthorizeQueryValid(oauthAuthorizeQuery(new URLSearchParams({ client_id: 'agent:x' }))), false)
})
