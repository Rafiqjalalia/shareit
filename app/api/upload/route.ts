import { NextRequest, NextResponse } from 'next/server';
import { saveTempFile } from '@/lib/storage';

export async function POST(req: NextRequest) {
  try {
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
