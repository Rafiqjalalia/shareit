import { NextRequest, NextResponse } from 'next/server';
import { tempFileStore } from '@/lib/storage';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const expiryHoursStr = (formData.get('expiryHours') as string) || '1';
    const expiryHours = parseInt(expiryHoursStr, 10);

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const fileId = Math.random().toString(36).substring(2, 10);
    const arrayBuffer = await file.arrayBuffer();
    const now = Date.now();
    const expiresAt = now + expiryHours * 60 * 60 * 1000;

    tempFileStore.set(fileId, {
      id: fileId,
      name: file.name,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
      buffer: arrayBuffer,
      createdAt: now,
      expiresAt: expiresAt,
      downloadCount: 0,
    });

    return NextResponse.json({
      success: true,
      fileId,
      name: file.name,
      size: file.size,
      expiresAt,
    });
  } catch (err) {
    console.error('Upload handler error:', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
