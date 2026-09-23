import { NextRequest, NextResponse } from 'next/server'
import { ensureOrgCloudInstance } from '@/lib/agents'
import {
  cloudEnsureBody,
  FlyNotConfiguredError,
} from '@/lib/cloud-entitlement'
import { resolvePortalOrg } from '@/lib/request-auth'

export const runtime = 'nodejs'
/** Awaits Fly provision. GET /api/agents stays a fast list. */
export const maxDuration = 300

/**
 * POST /api/cloud/ensure — create the org's single Cloud VM once the plan
 * is paid, finish one whose Fly machine never landed, resize one whose
 * size no longer matches that plan, park one when the org returns to Free,
 * or wake a parked machine on the next paid plan.
 * Free with no VM: 200 { ensured: false, reason: 'paid_plan_required' }.
 * Missing FLY_API_TOKEN: 503 before any DB insert.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { org?: string }
  const orgParam = body.org || req.nextUrl.searchParams.get('org') || null
  const resolved = await resolvePortalOrg(req, orgParam)
  if (!resolved.ok) {
    return NextResponse.json(resolved.body, { status: resolved.status })
  }

  try {
    const result = await ensureOrgCloudInstance({
      org: resolved.org,
      user: resolved.user,
    })
    const payload = result.ok
      ? cloudEnsureBody({
          ok: true,
          created: result.created,
          instanceId: result.agent.id,
        })
      : cloudEnsureBody(result)
    return NextResponse.json(payload)
  } catch (err) {
    if (err instanceof FlyNotConfiguredError) {
      return NextResponse.json(
        {
          error: err.code,
          message: err.message,
        },
        { status: 503 },
      )
    }
    throw err
  }
}
