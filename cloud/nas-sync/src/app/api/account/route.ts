import { NextRequest, NextResponse } from 'next/server'
import { deletePortalAccount } from '@/lib/account-delete'
import {
  parseAccountProfileBody,
  readPrivyAccountIdentity,
  savePrivyAccountProfile,
} from '@/lib/account-profile'
import { resolveActor } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { authorizationFromRequest } from '@/lib/request-auth'
import { ensureUserAndOrg, verifyPrivyBearer } from '@/lib/privy'

export const runtime = 'nodejs'

async function callerFromRequest(req: NextRequest) {
  const authHeader = authorizationFromRequest(req)
  if (!authHeader) return null
  const claims = await verifyPrivyBearer(authHeader)
  if (!claims?.userId) return null
  return claims
}

/**
 * The Privy person a read may answer for: a Portal session, or the Work4You
 * login the Desktop agent runs on (OAuth access token). The Desktop account
 * menu reads through that login, so signing in once covers it.
 */
async function readerPrivyDid(req: NextRequest): Promise<string | null> {
  const claims = await callerFromRequest(req)
  if (claims?.userId) return claims.userId
  const actor = await resolveActor(authorizationFromRequest(req))
  return actor?.via === 'oauth' ? actor.user.privyDid : null
}

/**
 * GET /api/account — the Privy person behind this session.
 * Auth: Privy bearer, privy-token cookie, or a Work4You OAuth access token.
 * Name is set only when the cadastro saved both parts. Email comes from the
 * Privy user (native, Google, or GitHub address). Either field may be null.
 */
export async function GET(req: NextRequest) {
  const privyDid = await readerPrivyDid(req)
  if (!privyDid) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const identity = await readPrivyAccountIdentity(privyDid)
    return NextResponse.json(identity)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'read_failed'
    return NextResponse.json(
      { error: 'server_error', error_description: msg },
      { status: 500 },
    )
  }
}

/**
 * PATCH /api/account — persist first + last name on the Privy user profile.
 * Auth: Privy bearer or privy-token cookie only (not OAuth access tokens).
 */
export async function PATCH(req: NextRequest) {
  const claims = await callerFromRequest(req)
  if (!claims?.userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const profile = parseAccountProfileBody(body)
  if (!profile) {
    return NextResponse.json(
      {
        error: 'invalid_profile',
        error_description: 'Informe nome e sobrenome.',
      },
      { status: 400 },
    )
  }

  try {
    const saved = await savePrivyAccountProfile(claims.userId, profile)
    return NextResponse.json({
      ok: true,
      firstName: saved.firstName,
      lastName: saved.lastName,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'save_failed'
    return NextResponse.json(
      { error: 'server_error', error_description: msg },
      { status: 500 },
    )
  }
}

/**
 * DELETE /api/account — permanently delete the caller's personal Portal account.
 * Auth: Privy bearer or privy-token cookie only (not OAuth access tokens).
 */
export async function DELETE(req: NextRequest) {
  const claims = await callerFromRequest(req)
  if (!claims?.userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { user } = await ensureUserAndOrg(claims.userId)
  const row = await prisma.user.findUnique({ where: { id: user.id } })
  if (!row) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  try {
    await deletePortalAccount(row.id, row.privyDid)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'delete_failed'
    if (msg === 'has_team_memberships') {
      return NextResponse.json(
        {
          error: 'has_team_memberships',
          error_description:
            'Não é possível apagar a conta enquanto pertencer a uma organização de equipa.',
        },
        { status: 409 },
      )
    }
    return NextResponse.json(
      { error: 'server_error', error_description: msg },
      { status: 500 },
    )
  }
}
