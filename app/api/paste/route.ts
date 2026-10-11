import { NextRequest, NextResponse } from 'next/server';
import { saveQuickPaste } from '@/lib/redis';
import { triggerQuickPasteRealtime } from '@/lib/pusher';
import { checkRateLimit } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  try {
    // 1. Rate limiting: 60 pastes/min
    const rateCheck = checkRateLimit(req, 60, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please wait a moment before sending more text.' },
        { status: 429 }
      );
    }

    // 2. Validate input
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { code, text } = body;

    if (!code || typeof code !== 'string' || code.trim().length < 4 || code.trim().length > 12) {
      return NextResponse.json({ error: 'Invalid pairing code' }, { status: 400 });
    }

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'Text cannot be empty' }, { status: 400 });
    }

    if (text.length > 5000) {
      return NextResponse.json(
        { error: 'Text exceeds maximum limit of 5,000 characters' },
        { status: 400 }
      );
    }

    // 3. Save to session store (inactivity TTL: 30 minutes, max 10 items)
    const item = await saveQuickPaste(code, text);

    // 4. Trigger real-time push notification via Pusher
    await triggerQuickPasteRealtime(item);

    return NextResponse.json({
      success: true,
      item,
    });
  } catch (err: any) {
    console.error('Quick paste POST error:', err);
    return NextResponse.json({ error: 'Failed to process paste' }, { status: 500 });
  }
}
