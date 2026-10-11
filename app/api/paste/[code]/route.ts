import { NextRequest, NextResponse } from 'next/server';
import { getQuickPastes, clearQuickPastes } from '@/lib/redis';
import { checkRateLimit } from '@/lib/rateLimit';

export async function GET(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const rateCheck = checkRateLimit(req, 120, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const { code } = params;
    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Invalid pairing code' }, { status: 400 });
    }

    const items = await getQuickPastes(code);

    return NextResponse.json({
      success: true,
      items,
    });
  } catch (err: any) {
    console.error('Quick paste GET error:', err);
    return NextResponse.json({ error: 'Failed to retrieve pastes' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const { code } = params;
    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Invalid pairing code' }, { status: 400 });
    }

    await clearQuickPastes(code);

    return NextResponse.json({
      success: true,
    });
  } catch (err: any) {
    console.error('Quick paste DELETE error:', err);
    return NextResponse.json({ error: 'Failed to clear pastes' }, { status: 500 });
  }
}
