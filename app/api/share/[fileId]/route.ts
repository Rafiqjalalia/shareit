import { NextRequest, NextResponse } from 'next/server';
import { resolveStoredFile, getDirectDownloadUrl } from '@/lib/storage';

export async function GET(
  req: NextRequest,
  { params }: { params: { fileId: string } }
) {
  const { fileId } = params;
  const item = await resolveStoredFile(fileId);

  if (!item) {
    return NextResponse.json({ error: 'This temporary file link has expired or was deleted.' }, { status: 404 });
  }

  if (Date.now() > item.expiresAt) {
    return NextResponse.json({ error: 'This temporary file link has expired.' }, { status: 410 });
  }

  item.downloadCount += 1;

  // Stream from persistent remote temporary storage
  if (item.remoteUrl) {
    try {
      const directUrl = await getDirectDownloadUrl(item.remoteUrl);
      const remoteRes = await fetch(directUrl);
      if (remoteRes.ok && remoteRes.body) {
        return new NextResponse(remoteRes.body, {
          headers: {
            'Content-Type': item.mimeType || 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${encodeURIComponent(item.name)}"`,
            'Content-Length': item.size.toString(),
          },
        });
      }
    } catch (fetchErr) {
      console.error('Failed to stream remote file:', fetchErr);
    }
  }

  // Fallback to in-memory buffer if present
  if (item.buffer) {
    const fileBuffer = Buffer.from(item.buffer, 'base64');
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': item.mimeType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(item.name)}"`,
        'Content-Length': item.size.toString(),
      },
    });
  }

  return NextResponse.json({ error: 'File content could not be retrieved' }, { status: 500 });
}

export async function HEAD(
  req: NextRequest,
  { params }: { params: { fileId: string } }
) {
  const { fileId } = params;
  const item = await resolveStoredFile(fileId);

  if (!item || Date.now() > item.expiresAt) {
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
