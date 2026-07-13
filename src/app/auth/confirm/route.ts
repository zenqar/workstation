import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAppUrl } from '@/lib/env/server';
import { locales } from '@/i18n/routing';

const EMAIL_OTP_TYPES = new Set<EmailOtpType>([
  'email',
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
]);

function safeLocale(value: string | null): string {
  return value && locales.includes(value as (typeof locales)[number]) ? value : 'en';
}

function loginError(appUrl: string, locale: string, message: string) {
  const url = new URL(`/${locale}/login`, appUrl);
  url.searchParams.set('error', message);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const appUrl = await getAppUrl();
  const locale = safeLocale(searchParams.get('locale'));
  const tokenHash = searchParams.get('token_hash');
  const typeValue = searchParams.get('type') as EmailOtpType | null;

  if (!tokenHash || !typeValue || !EMAIL_OTP_TYPES.has(typeValue)) {
    return loginError(appUrl, locale, 'Invalid or incomplete email link');
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: typeValue,
  });

  if (error) {
    console.error('[AuthConfirm] Verification failed:', error.message);
    return loginError(appUrl, locale, 'Email link is invalid or has expired');
  }

  if (typeValue === 'recovery') {
    return NextResponse.redirect(new URL(`/${locale}/reset-password`, appUrl));
  }

  const { data: memberships } = await supabase
    .from('business_memberships')
    .select('id')
    .limit(1);

  const destination = memberships?.length
    ? `/${locale}/app/dashboard`
    : `/${locale}/app/onboarding`;

  return NextResponse.redirect(new URL(destination, appUrl));
}
