export interface OAuthAuthorizeQuery {
  client_id: string
  code_challenge: string
  code_challenge_method: string
  redirect_uri: string
  response_type: string
  scope: string
  state: string
}

export function oauthAuthorizeQuery(params: { get(name: string): null | string }): OAuthAuthorizeQuery {
  return {
    client_id: params.get('client_id') || '',
    code_challenge: params.get('code_challenge') || '',
    code_challenge_method: params.get('code_challenge_method') || 'S256',
    redirect_uri: params.get('redirect_uri') || '',
    response_type: params.get('response_type') || '',
    scope: params.get('scope') || '',
    state: params.get('state') || ''
  }
}

/** Agent dashboard OAuth is valid only as an authorization-code request for `agent:{id}`. */
export function oauthAuthorizeQueryValid(query: OAuthAuthorizeQuery): boolean {
  return (
    query.response_type === 'code' &&
    query.client_id.startsWith('agent:') &&
    query.redirect_uri.length > 0 &&
    query.state.length > 0 &&
    query.code_challenge.length > 0
  )
}

/**
 * A signed-in portal session approves the agent link by itself.
 * One attempt, then a failure can be retried from the screen.
 */
export function shouldAutoApproveAgentLink(args: {
  attempted: boolean
  authenticated: boolean
  ready: boolean
  valid: boolean
}): boolean {
  return args.ready && args.authenticated && args.valid && !args.attempted
}
