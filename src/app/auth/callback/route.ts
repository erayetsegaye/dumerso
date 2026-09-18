import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getAdminClient, isSupabaseAdminConfigured, isSupabaseConfigured } from '@/lib/supabase/admin';
import {
  INVITE_COOKIE,
  getOrCreateUserProfile,
  inviteCodeMatches,
  inviteCodeRequired,
  isBootstrapAdmin,
} from '@/lib/auth';

function redirectWithCookies(
  url: string,
  cookieStore: ReturnType<typeof cookies>
): NextResponse {
  const response = NextResponse.redirect(url);
  cookieStore.getAll().forEach((cookie) => {
    response.cookies.set(cookie.name, cookie.value);
  });
  return response;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const oauthError = searchParams.get('error');
  const login = new URL('/admin/login', origin);

  if (oauthError) {
    login.searchParams.set('error', 'auth');
    return NextResponse.redirect(login);
  }

  if (!code || !isSupabaseConfigured()) {
    login.searchParams.set('error', 'auth');
    return NextResponse.redirect(login);
  }

  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    login.searchParams.set('error', 'auth');
    return NextResponse.redirect(login);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isSupabaseAdminConfigured()) {
    await supabase.auth.signOut().catch(() => undefined);
    login.searchParams.set('error', 'config');
    return redirectWithCookies(login.toString(), cookieStore);
  }

  const inviteCode = cookieStore.get(INVITE_COOKIE)?.value;
  cookieStore.set(INVITE_COOKIE, '', { path: '/', maxAge: 0 });

  const existing = await getAdminClient()
    .from('profiles')
    .select('id, disabled')
    .eq('id', user.id)
    .maybeSingle();

  const isNewAccount = !existing.data;

  if (isNewAccount && !isBootstrapAdmin(user.email) && !inviteCodeMatches(inviteCode)) {
    await getAdminClient().auth.admin.deleteUser(user.id).catch(() => undefined);
    await supabase.auth.signOut().catch(() => undefined);
    login.searchParams.set(
      'error',
      inviteCodeRequired() ? 'invite' : 'closed'
    );
    return redirectWithCookies(login.toString(), cookieStore);
  }

  if (existing.data?.disabled) {
    await supabase.auth.signOut().catch(() => undefined);
    login.searchParams.set('error', 'disabled');
    return redirectWithCookies(login.toString(), cookieStore);
  }

  const profile = await getOrCreateUserProfile({
    uid: user.id,
    email: user.email ?? null,
    displayName: user.user_metadata?.full_name || user.user_metadata?.name || null,
    photoURL: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
  });

  const destination =
    profile.role === 'admin' || profile.role === 'staff' ? '/admin' : '/admin/pending';

  return redirectWithCookies(`${origin}${destination}`, cookieStore);
}
