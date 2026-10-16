import { NextRequest, NextResponse } from 'next/server';
import {
  getClipboardSpace,
  updateClipboardItem,
  clearClipboardSpace,
  leaveClipboardSpace,
  SpaceDevice,
} from '@/lib/redis';
import { triggerClipboardEvent } from '@/lib/pusher';
import { checkRateLimit } from '@/lib/rateLimit';

export async function GET(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const rateCheck = checkRateLimit(req, 120, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: 'rate_limited', message: 'Rate limit exceeded' }, { status: 429 });
    }

    const { code } = params;
    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'invalid_code', message: 'Invalid pairing code' }, { status: 400 });
    }

    const url = new URL(req.url);
    const deviceId = url.searchParams.get('deviceId');
    const deviceName = url.searchParams.get('deviceName');
    const deviceType = url.searchParams.get('deviceType') as 'mobile' | 'tablet' | 'desktop' | null;

    let device: SpaceDevice | undefined = undefined;
    if (deviceId) {
      device = {
        deviceId,
        deviceName: deviceName || 'Device',
        deviceType: deviceType === 'mobile' || deviceType === 'tablet' ? deviceType : 'desktop',
        lastSeen: Date.now(),
      };
    }

    const res = await getClipboardSpace(code, device);

    if (res.status === 'device_limit_reached') {
      return NextResponse.json(
        {
          success: false,
          error: 'device_limit_reached',
          message: res.message,
          space: res.space,
          items: res.space?.items || [],
        },
        { status: 403 }
      );
    }

    if (res.status !== 'ok' || !res.space) {
      return NextResponse.json({ error: 'not_found', message: 'Clipboard space not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      space: res.space,
      items: res.space.items,
      devices: res.space.devices,
      lastUpdated: res.space.lastUpdated,
    });
  } catch (err: any) {
    console.error('Clipboard space GET error:', err);
    return NextResponse.json({ error: 'server_error', message: 'Failed to retrieve clipboard space' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const rateCheck = checkRateLimit(req, 60, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: 'rate_limited', message: 'Rate limit exceeded' }, { status: 429 });
    }

    const { code } = params;
    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'invalid_code', message: 'Invalid pairing code' }, { status: 400 });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'invalid_json', message: 'Invalid JSON body' }, { status: 400 });
    }

    const { action, itemId } = body;
    if (!action || !['pin', 'unpin', 'delete'].includes(action) || !itemId) {
      return NextResponse.json({ error: 'invalid_request', message: 'Missing action or itemId' }, { status: 400 });
    }

    const res = await updateClipboardItem(code, itemId, action);
    if (!res.success) {
      return NextResponse.json({ error: 'action_failed', message: 'Failed to update item' }, { status: 400 });
    }

    // Trigger real-time update
    await triggerClipboardEvent(code, 'item-action', { action, itemId });

    return NextResponse.json({
      success: true,
      space: res.space,
    });
  } catch (err: any) {
    console.error('Clipboard space PATCH error:', err);
    return NextResponse.json({ error: 'server_error', message: 'Failed to update clipboard item' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const rateCheck = checkRateLimit(req, 60, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: 'rate_limited', message: 'Rate limit exceeded' }, { status: 429 });
    }

    const { code } = params;
    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'invalid_code', message: 'Invalid pairing code' }, { status: 400 });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    const deviceId = url.searchParams.get('deviceId');

    if (action === 'leave' && deviceId) {
      await leaveClipboardSpace(code, deviceId);
      await triggerClipboardEvent(code, 'device-left', { deviceId });
      return NextResponse.json({ success: true, message: 'Device left clipboard space' });
    }

    // Default: Clear all items
    await clearClipboardSpace(code);
    await triggerClipboardEvent(code, 'space-cleared', {});

    return NextResponse.json({
      success: true,
      message: 'Clipboard space cleared',
    });
  } catch (err: any) {
    console.error('Clipboard space DELETE error:', err);
    return NextResponse.json({ error: 'server_error', message: 'Failed to clear clipboard space' }, { status: 500 });
  }
}
