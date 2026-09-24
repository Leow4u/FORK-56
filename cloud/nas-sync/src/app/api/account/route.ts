import { NextRequest, NextResponse } from 'next/server'
import { deletePortalAccount } from '@/lib/account-delete'
import {
  parseAccountProfileBody,
  readPrivyAccountProfile,
  savePrivyAccountProfile,
} from '@/lib/account-profile'
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
 * GET /api/account — the caller's cadastro name (Privy customMetadata).
 * Auth: Privy bearer or privy-token cookie only (not OAuth access tokens).
 * Missing name is `{ firstName: null, lastName: null }`, not an error.
 */
export async function GET(req: NextRequest) {
  const claims = await callerFromRequest(req)
  if (!claims?.userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const profile = await readPrivyAccountProfile(claims.userId)
    return NextResponse.json({
      firstName: profile?.firstName ?? null,
      lastName: profile?.lastName ?? null,
    })
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
