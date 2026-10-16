import { NextRequest, NextResponse } from 'next/server';
import { saveClipboardItem } from '@/lib/redis';
import { triggerClipboardEvent } from '@/lib/pusher';
import { checkRateLimit } from '@/lib/rateLimit';
import { CLIPBOARD_CONFIG } from '@/lib/clipboardConfig';

export async function POST(req: NextRequest) {
  try {
    // 1. Rate limiting: 60 pastes/min
    const rateCheck = checkRateLimit(req, 60, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'rate_limited', message: 'Rate limit exceeded. Please wait a moment before sending more text.' },
        { status: 429 }
      );
    }

    // 2. Validate JSON body
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'invalid_json', message: 'Invalid JSON body' }, { status: 400 });
    }

    const { code, text, deviceId, deviceName, deviceType } = body;

    if (!code || typeof code !== 'string' || code.trim().length < 4 || code.trim().length > 12) {
      return NextResponse.json({ error: 'invalid_code', message: 'Invalid pairing code' }, { status: 400 });
    }

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'empty_text', message: 'Text cannot be empty' }, { status: 400 });
    }

    // 3. Save to clipboard space store
    const result = await saveClipboardItem(code, {
      text,
      deviceId,
      deviceName,
      deviceType: deviceType === 'mobile' || deviceType === 'tablet' ? deviceType : 'desktop',
    });

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error,
          message: result.message,
          proNotice: result.error === 'item_limit_reached' ? CLIPBOARD_CONFIG.PRO_UPGRADE_MESSAGE : undefined,
        },
        { status: 400 }
      );
    }

    // 4. Trigger real-time push notification via Pusher
    await triggerClipboardEvent(code, 'new-item', result.item);

    return NextResponse.json({
      success: true,
      item: result.item,
      space: result.space,
    });
  } catch (err: any) {
    console.error('Clipboard paste POST error:', err);
    return NextResponse.json({ error: 'server_error', message: 'Failed to process paste' }, { status: 500 });
  }
}
