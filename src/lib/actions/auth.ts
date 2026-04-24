'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ActionResult } from '@/lib/types';
import { z } from 'zod';
import { getLocale } from 'next-intl/server';
import { getLocalizedPath } from '@/lib/utils/locale';

// ============================================================
// Validation schemas
// ============================================================

const SignUpSchema = z.object({
  email:         z.string().email(),
  password:      z.string().min(8, 'Password must be at least 8 characters'),
  fullName:      z.string().min(2, 'Name must be at least 2 characters'),
  businessName:  z.string().min(2, 'Business name required'),
});

const SignInSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

// ============================================================
// Sign Up — creates user + profile + first business + membership
// ============================================================

export async function signUp(formData: FormData): Promise<ActionResult> {
  const currentLocale = await getLocale();
  const formLocale = formData.get('locale') as string;
  const locale = formLocale || currentLocale;
  
  try {
    const raw = {
      email:        formData.get('email') as string,
      password:     formData.get('password') as string,
      fullName:     formData.get('fullName') as string,
      businessName: formData.get('businessName') as string,
    };

    const parsed = SignUpSchema.safeParse(raw);
    if (!parsed.success) {
      return { error: parsed.error.issues[0].message };
    }

    const supabase = await createClient();
    const admin    = await createAdminClient();
    const { getAppUrl } = await import('@/lib/env/server');
    const appUrl = await getAppUrl();

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email:    parsed.data.email,
      password: parsed.data.password,
      options:  {
        data: { full_name: parsed.data.fullName },
        emailRedirectTo: `${appUrl}/${locale}/auth/callback`,
      },
    });

    if (authError) {
      console.error('[Signup] Auth Error:', authError);
      return { error: authError.message || 'Authentication failed' };
    }

    const userId = authData.user?.id;
    if (!userId) {
      return { error: 'Failed to create user account' };
    }

    // Create business (use admin client to bypass RLS on insert before membership exists)
    const { data: business, error: bizError } = await admin
      .from('businesses')
      .insert({
        name:       parsed.data.businessName,
        created_by: userId,
      })
      .select()
      .single();

    if (bizError || !business) {
      console.error('[Signup] Business Error:', bizError);
      return { error: `Business creation failed: ${bizError?.message || 'Database error'}` };
    }

    // Create owner membership
    const { error: memberError } = await admin
      .from('business_memberships')
      .insert({
        business_id: business.id,
        user_id:     userId,
        role:        'owner',
        status:      'active',
      });

    if (memberError) {
      console.error('[Signup] Membership Error:', memberError);
      return { error: `Setup failed: ${memberError.message || 'Could not link business'}` };
    }

    // If email confirmation is enabled, session might be null
    if (!authData.session) {
      redirect(getLocalizedPath(locale, '/login?message=check-email'));
    }
  } catch (e: any) {
    if (e?.message === 'NEXT_REDIRECT') throw e;
    console.error('[Signup] Unexpected Error:', e);
    const errorMessage = typeof e === 'string' ? e : (e?.message || e?.error_description || 'An unexpected error occurred during signup');
    return { error: String(errorMessage) };
  }

  redirect(getLocalizedPath(locale, '/app/dashboard'));
}

// ============================================================
// Sign In
// ============================================================

export async function signIn(formData: FormData): Promise<ActionResult> {
  const currentLocale = await getLocale();
  const formLocale = formData.get('locale') as string;
  const locale = formLocale || currentLocale;
  
  const raw = {
    email:    formData.get('email') as string,
    password: formData.get('password') as string,
  };

  const parsed = SignInSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: 'Invalid email or password' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email:    parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    console.error('[SignIn] Detailed Error:', error);
    
    // Provide more detailed feedback in development
    if (process.env.NODE_ENV === 'development') {
      return { error: `Auth Error: ${error.message} (Code: ${error.code})` };
    }
    
    return { error: error.message || 'Invalid email or password' };
  }

  redirect(getLocalizedPath(locale, '/app/dashboard'));
}

// ============================================================
// Sign Out
// ============================================================

export async function signOut(): Promise<void> {
  const locale = await getLocale();
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(getLocalizedPath(locale, '/login'));
}

// ============================================================
// Forgot Password
// ============================================================

export async function forgotPassword(formData: FormData): Promise<ActionResult> {
  const currentLocale = await getLocale();
  const formLocale = formData.get('locale') as string;
  const locale = formLocale || currentLocale;
  
  const email = formData.get('email') as string;
  
  if (!email || !z.string().email().safeParse(email).success) {
    return { error: 'Please enter a valid email address' };
  }

  const supabase = await createClient();
  const { getAppUrl } = await import('@/lib/env/server');
  const appUrl = await getAppUrl();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/${locale}/auth/callback?next=/${locale}/reset-password`,
  });

  if (error) {
    return { error: error.message };
  }

  return { data: undefined };
}

// ============================================================
// Reset Password
// ============================================================

export async function resetPassword(formData: FormData): Promise<ActionResult> {
  const currentLocale = await getLocale();
  const formLocale = formData.get('locale') as string;
  const locale = formLocale || currentLocale;
  
  const password = formData.get('password') as string;
  const confirm  = formData.get('confirmPassword') as string;

  if (!password || password.length < 8) {
    return { error: 'Password must be at least 8 characters' };
  }

  if (password !== confirm) {
    return { error: 'Passwords do not match' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: error.message };
  }

  redirect(getLocalizedPath(locale, '/app/dashboard'));
}
