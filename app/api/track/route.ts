import { NextRequest, NextResponse } from 'next/server';
import { recordLinkActivity } from '@/lib/redis';
import { checkRateLimit, isValidFileId, isValidTrackEvent } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  try {
    // 1. Rate limiting
    const rateCheck = checkRateLimit(req, 120, 60000); // 120 track events/min per IP
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    // 2. Input validation
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { fileId, event } = body;

    if (!isValidFileId(fileId)) {
      return NextResponse.json({ error: 'Invalid or missing fileId' }, { status: 400 });
    }

    if (!isValidTrackEvent(event)) {
      return NextResponse.json(
        { error: 'Invalid event type. Must be "open" or "download"' },
        { status: 400 }
      );
    }

    // 3. Atomically record activity (PRIVACY: only counts and timestamps are updated)
    const result = await recordLinkActivity(fileId, event);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Link not found, expired, or failed to record activity' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      event,
      opens: result.opens,
      downloads: result.downloads,
    });
  } catch (err: any) {
    console.error('Tracking API error:', err);
    return NextResponse.json({ error: 'Internal tracking error' }, { status: 500 });
  }
}
