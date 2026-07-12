import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const BUCKET = 'business-documents';
const MAX_FILE_SIZE = 8 * 1024 * 1024;
const TYPE_TO_EXTENSION: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function isRealDocument(bytes: Uint8Array, type: string) {
  if (type === 'application/pdf') return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
  if (type === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === 'image/png') return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (type === 'image/webp') return String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  return false;
}

async function requireDocumentAccess(businessId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const { data: membership } = await supabase
    .from('business_memberships')
    .select('role')
    .eq('business_id', businessId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (!membership || !['owner', 'admin', 'accountant', 'staff'].includes(membership.role)) {
    return { error: NextResponse.json({ error: 'Permission denied' }, { status: 403 }) };
  }
  return { user };
}

async function ensurePrivateBucket() {
  const admin = await createAdminClient();
  const { data } = await admin.storage.getBucket(BUCKET);
  if (!data) {
    const { error } = await admin.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: MAX_FILE_SIZE,
      allowedMimeTypes: Object.keys(TYPE_TO_EXTENSION),
    });
    if (error && !error.message.toLowerCase().includes('already exists')) throw error;
  }
  return admin;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const businessId = z.string().uuid().safeParse(formData.get('business_id'));
    const file = formData.get('file');
    if (!businessId.success) return NextResponse.json({ error: 'Invalid business.' }, { status: 400 });
    if (!(file instanceof File)) return NextResponse.json({ error: 'Choose a document.' }, { status: 400 });
    if (!TYPE_TO_EXTENSION[file.type]) return NextResponse.json({ error: 'Unsupported file type.' }, { status: 415 });
    if (file.size === 0 || file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'The document must be smaller than 8 MB.' }, { status: 413 });

    const access = await requireDocumentAccess(businessId.data);
    if ('error' in access) return access.error;

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!isRealDocument(bytes, file.type)) return NextResponse.json({ error: 'The file contents do not match its document type.' }, { status: 415 });
    const admin = await ensurePrivateBucket();
    const path = `${businessId.data}/${access.user.id}/${crypto.randomUUID()}.${TYPE_TO_EXTENSION[file.type]}`;
    const { error } = await admin.storage.from(BUCKET).upload(path, bytes, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: false,
    });
    if (error) throw error;

    return NextResponse.json({ path }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[document-upload]', error);
    return NextResponse.json({ error: 'The original document could not be saved.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const payload = await request.json() as { path?: string };
    const path = payload.path?.split('/').filter(Boolean);
    if (!path || path.length !== 3 || !z.string().uuid().safeParse(path[0]).success) {
      return NextResponse.json({ error: 'Invalid document path.' }, { status: 400 });
    }
    const access = await requireDocumentAccess(path[0]);
    if ('error' in access) return access.error;
    if (path[1] !== access.user.id) return NextResponse.json({ error: 'Permission denied' }, { status: 403 });

    const admin = await createAdminClient();
    const { error } = await admin.storage.from(BUCKET).remove([path.join('/')]);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[document-delete]', error);
    return NextResponse.json({ error: 'Document cleanup failed.' }, { status: 500 });
  }
}
