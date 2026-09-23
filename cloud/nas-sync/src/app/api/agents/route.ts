import { NextRequest, NextResponse } from 'next/server'
import { cloudSizeCatalog, listAgents } from '@/lib/agents'
import { cloudEntitlement, manualCloudCreateRefusal } from '@/lib/cloud-entitlement'
import { resolvePortalOrg } from '@/lib/request-auth'

export const runtime = 'nodejs'
/** GET may reconcile Fly state for pending rows. */
export const maxDuration = 300

/**
 * GET /api/agents?org= — list Cloud instances and the plan entitlement.
 * Auth: Bearer or privy-token cookie.
 * Multi-org without ?org= → 409 org_selection_required.
 *
 * POST /api/agents — closed. Name, size, and model are ignored.
 * 403 manual_create_disabled. The only creator is ensureOrgCloudInstance().
 */
export async function GET(req: NextRequest) {
  const orgParam = req.nextUrl.searchParams.get('org')
  const resolved = await resolvePortalOrg(req, orgParam)
  if (!resolved.ok) {
    return NextResponse.json(resolved.body, { status: resolved.status })
  }

  const agents = await listAgents(resolved.org.id)
  return NextResponse.json({
    agents,
    org: {
      id: resolved.org.id,
      slug: resolved.org.slug,
      name: resolved.org.name,
      isPersonal: resolved.org.personal,
      role: resolved.role,
    },
    sizes: cloudSizeCatalog(),
    entitlement: cloudEntitlement(resolved.org.subscriptionTierId),
  })
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { org?: string }
  const orgParam = body.org || req.nextUrl.searchParams.get('org') || null
  const resolved = await resolvePortalOrg(req, orgParam)
  if (!resolved.ok) {
    return NextResponse.json(resolved.body, { status: resolved.status })
  }

  const refusal = manualCloudCreateRefusal()
  return NextResponse.json(refusal.body, { status: refusal.status })
}
