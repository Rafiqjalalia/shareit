import { NextRequest, NextResponse } from 'next/server';
import { tempFileStore } from '@/lib/storage';

export async function GET(
  req: NextRequest,
  { params }: { params: { fileId: string } }
) {
  const { fileId } = params;
  const item = tempFileStore.get(fileId);

  if (!item) {
    return NextResponse.json({ error: 'File not found or expired' }, { status: 404 });
  }

  // Check if expired
  if (Date.now() > item.expiresAt) {
    tempFileStore.delete(fileId);
    return NextResponse.json({ error: 'This temporary file link has expired' }, { status: 410 });
  }

  item.downloadCount += 1;

  // Stream file response with proper headers
  return new NextResponse(item.buffer, {
    headers: {
      'Content-Type': item.mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(item.name)}"`,
      'Content-Length': item.size.toString(),
    },
  });
}

export async function HEAD(
  req: NextRequest,
  { params }: { params: { fileId: string } }
) {
  const { fileId } = params;
  const item = tempFileStore.get(fileId);

  if (!item || Date.now() > item.expiresAt) {
    if (item) tempFileStore.delete(fileId);
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(null, {
    status: 200,
    headers: {
      'Content-Type': item.mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(item.name)}"`,
      'Content-Length': item.size.toString(),
    },
  });
}
