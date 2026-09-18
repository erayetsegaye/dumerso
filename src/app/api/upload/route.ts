import { NextResponse } from 'next/server';
import { denyUnlessApproved } from '@/lib/api-auth';
import { getAdminClient, isSupabaseAdminConfigured, MENU_IMAGES_BUCKET } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

function safeExtension(fileName: string | undefined, mimeType: string | undefined): string | null {
  const fromName = (fileName && fileName.includes('.'))
    ? `.${fileName.split('.').pop()?.toLowerCase()}`
    : '';
  const fromMime = mimeType ? EXT_BY_MIME[mimeType] : undefined;
  const ext = fromMime || fromName;
  if (!ALLOWED_EXT.has(ext)) return null;
  return ext;
}

function fileNameFor(ext: string): string {
  return `item-${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
}

async function uploadBuffer(buffer: Buffer, ext: string, contentType: string): Promise<string> {
  const filename = fileNameFor(ext);
  const admin = getAdminClient();
  const { error } = await admin.storage.from(MENU_IMAGES_BUCKET).upload(filename, buffer, {
    contentType,
    upsert: false,
  });
  if (error) throw error;
  const { data } = admin.storage.from(MENU_IMAGES_BUCKET).getPublicUrl(filename);
  return data.publicUrl;
}

export async function POST(request: Request) {
  try {
    const denied = await denyUnlessApproved();
    if (denied) return denied;

    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json(
        { error: 'Supabase is not configured on the server yet.' },
        { status: 503 }
      );
    }

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;

      if (!file) {
        return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
      }

      const ext = safeExtension(file.name, file.type);
      if (!ext) {
        return NextResponse.json(
          { error: 'Please upload a JPG, PNG, WEBP, or GIF image.' },
          { status: 400 }
        );
      }

      const bytes = await file.arrayBuffer();
      const url = await uploadBuffer(Buffer.from(bytes), ext, file.type || 'image/jpeg');
      return NextResponse.json({ url });
    }

    const body = await request.json();
    const { image, fileName } = body;

    if (!image) {
      return NextResponse.json({ error: 'No image data provided' }, { status: 400 });
    }

    const mimeMatch = typeof image === 'string' ? image.match(/^data:(image\/\w+);base64,/) : null;
    const mime = mimeMatch?.[1] || 'image/jpeg';
    const ext = safeExtension(fileName, mime);
    if (!ext) {
      return NextResponse.json(
        { error: 'Please upload a JPG, PNG, WEBP, or GIF image.' },
        { status: 400 }
      );
    }

    const base64Data = String(image).replace(/^data:image\/\w+;base64,/, '');
    const url = await uploadBuffer(Buffer.from(base64Data, 'base64'), ext, mime);
    return NextResponse.json({ url });
  } catch (error) {
    console.error('API Upload POST error:', error);
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
  }
}
