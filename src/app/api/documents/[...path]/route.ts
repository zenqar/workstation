import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path;
  if (parts.length !== 3 || !z.string().uuid().safeParse(parts[0]).success) {
    return NextResponse.json({ error: 'Invalid document path.' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: membership } = await supabase
    .from('business_memberships')
    .select('id')
    .eq('business_id', parts[0])
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: 'Permission denied' }, { status: 403 });

  const admin = await createAdminClient();
  const { data, error } = await admin.storage.from('business-documents').createSignedUrl(parts.join('/'), 60);
  if (error || !data?.signedUrl) return NextResponse.json({ error: 'Document not found.' }, { status: 404 });

  return NextResponse.redirect(data.signedUrl, { headers: { 'Cache-Control': 'private, no-store' } });
}
