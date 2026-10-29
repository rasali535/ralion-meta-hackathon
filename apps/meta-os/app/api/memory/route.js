import { NextResponse } from 'next/server';
import { resolveRequestAuth } from '../../../lib/session';
import { listDecisionMemories, deriveBusinessLessons } from '../../../lib/memory';

/**
 * GET /api/memory
 *
 * Returns tenant-isolated decision memory and derived review lessons:
 * - Past decisions informing current drafts (counts, recency, deltas).
 * - Lessons derived strictly from review outcomes (approved, edited, rejected).
 * - Every lesson cites its source decisions.
 * - Clear disclaimer: learned strictly from workspace reviews, not ad metrics.
 */
export async function GET(request) {
  let tenant;
  try {
    tenant = resolveRequestAuth(request);
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Unauthorized' },
      { status: err.httpStatus || 401 }
    );
  }

  try {
    const url = new URL(request.url);
    const limitParam = parseInt(url.searchParams.get('limit') || '50', 10);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(1, limitParam), 100) : 50;

    const memories = listDecisionMemories(tenant, { limit });
    const analysis = deriveBusinessLessons(memories);

    return NextResponse.json(
      {
        ok: true,
        tenant: {
          organizationId: tenant.organizationId,
          workspaceId: tenant.workspaceId
        },
        ...analysis,
        memories
      },
      {
        headers: {
          'cache-control': 'no-store'
        }
      }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Failed to retrieve workspace memory' },
      { status: 500 }
    );
  }
}
