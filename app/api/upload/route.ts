import { NextRequest, NextResponse } from 'next/server';
import { saveTempFile, saveRemoteTempFile } from '@/lib/storage';

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';

    // 1. JSON payload: Direct client upload reference (bypasses 4.5MB Vercel serverless limit)
    if (contentType.includes('application/json')) {
      const body = await req.json();
      const { remoteUrl, name, size, mimeType, expiryHours } = body;

      if (!remoteUrl || !name) {
        return NextResponse.json({ error: 'Missing remoteUrl or name' }, { status: 400 });
      }

      const { fileId, fileInfo } = saveRemoteTempFile({
        remoteUrl,
        name,
        size: Number(size) || 0,
        mimeType: mimeType || 'application/octet-stream',
        expiryHours: Number(expiryHours) || 1,
      });

      return NextResponse.json({
        success: true,
        fileId,
        name: fileInfo.name,
        size: fileInfo.size,
        expiresAt: fileInfo.expiresAt,
      });
    }

    // 2. FormData payload: Small file direct upload (< 4MB)
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const expiryHoursStr = (formData.get('expiryHours') as string) || '1';
    const expiryHours = parseInt(expiryHoursStr, 10);

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const { fileId, fileInfo } = await saveTempFile(file, expiryHours);

    return NextResponse.json({
      success: true,
      fileId,
      name: fileInfo.name,
      size: fileInfo.size,
      expiresAt: fileInfo.expiresAt,
    });
  } catch (err: any) {
    console.error('Upload handler error:', err);
    return NextResponse.json({ error: err?.message || 'Upload failed' }, { status: 500 });
  }
}
