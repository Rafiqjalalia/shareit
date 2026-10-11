import { NextRequest, NextResponse } from 'next/server';
import { getLinkStats } from '@/lib/redis';
import { checkRateLimit, isValidFileId } from '@/lib/rateLimit';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Rate limiting
    const rateCheck = checkRateLimit(req, 120, 60000); // 120 stats polls/min
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const { id } = params;
    if (!isValidFileId(id)) {
      return NextResponse.json({ error: 'Invalid link id' }, { status: 400 });
    }

    // 2. Extract owner token from header or query param
    const authHeader = req.headers.get('authorization') || '';
    const bearerToken = authHeader.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7).trim()
      : '';
    const customHeaderToken = req.headers.get('x-owner-token') || '';
    const queryToken = req.nextUrl.searchParams.get('token') || '';

    const ownerToken = bearerToken || customHeaderToken || queryToken;

    if (!ownerToken) {
      return NextResponse.json(
        { error: 'Unauthorized: Owner token is required to view link statistics' },
        { status: 401 }
      );
    }

    // 3. Fetch statistics with authorization check
    const result = await getLinkStats(id, ownerToken);

    if (result.status === 'not_found') {
      return NextResponse.json(
        { error: 'Link statistics not found or link has expired' },
        { status: 404 }
      );
    }

    if (result.status === 'unauthorized') {
      return NextResponse.json(
        { error: 'Forbidden: Invalid owner token for this link' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.stats,
    });
  } catch (err: any) {
    console.error('Stats API error:', err);
    return NextResponse.json({ error: 'Internal stats error' }, { status: 500 });
  }
}
