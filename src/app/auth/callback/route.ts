import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies';
import {
  getAdminClient,
  isSupabaseAdminConfigured,
  isSupabaseConfigured,
} from '@/lib/supabase/admin';
import {
  DELETE_COOKIE,
  INVITE_COOKIE,
  expireCookieOnAllPaths,
  getOrCreateUserProfile,
  inviteCodeMatches,
  inviteCodeRequired,
  isBootstrapAdmin,
} from '@/lib/auth';

type PendingCookie = {
  name: string;
  value: string;
  options?: Partial<ResponseCookie>;
};

function redirectWithCookies(
  url: string,
  pending: PendingCookie[],
  expire: string[] = []
): NextResponse {
  const response = NextResponse.redirect(url);

  // The two mechanisms cannot be combined: response.cookies.set() re-serialises
  // the Set-Cookie header and keeps one entry per name, which would discard the
  // extra paths. A failed exchange has no session worth forwarding anyway, so
  // cleanup wins when both are present.
  if (expire.length > 0) {
    expire.forEach((name) => expireCookieOnAllPaths(response.headers, name));
    return response;
  }

  pending.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
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
  const pendingCookies: PendingCookie[] = [];

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
            pendingCookies.push({ name, value, options });

            try {
              cookieStore.set(name, value, options);
            } catch {
              // Route handlers may refuse late writes; the redirect still carries them.
            }
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('OAuth exchange error:', error);

    // A stale duplicate cookie (scoped to /auth or /admin by an older build)
    // shadows the real one and makes every future sign-in fail the same way.
    // The user cannot reach sign-out to clear it, so clear it here and let the
    // next attempt start from a clean slate.
    const poisoned = cookieStore
      .getAll()
      .filter((cookie) => cookie.name.startsWith('sb-'))
      .map((cookie) => cookie.name);

    login.searchParams.set('error', 'auth');
    return redirectWithCookies(login.toString(), pendingCookies, poisoned);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isSupabaseAdminConfigured()) {
    await supabase.auth.signOut().catch(() => undefined);
    login.searchParams.set('error', 'config');

    return redirectWithCookies(login.toString(), pendingCookies);
  }

  const inviteCode = cookieStore.get(INVITE_COOKIE)?.value;

  pendingCookies.push({
    name: INVITE_COOKIE,
    value: '',
    options: { ...DELETE_COOKIE, path: '/' },
  });

  const existing = await getAdminClient()
    .from('profiles')
    .select('id, disabled')
    .eq('id', user.id)
    .maybeSingle();

  const isNewAccount = !existing.data;

  if (
    isNewAccount &&
    !isBootstrapAdmin(user.email) &&
    !inviteCodeMatches(inviteCode)
  ) {
    await getAdminClient().auth.admin.deleteUser(user.id).catch(() => undefined);
    await supabase.auth.signOut().catch(() => undefined);

    login.searchParams.set(
      'error',
      inviteCodeRequired() ? 'invite' : 'closed'
    );

    return redirectWithCookies(login.toString(), pendingCookies);
  }

  if (existing.data?.disabled) {
    await supabase.auth.signOut().catch(() => undefined);
    login.searchParams.set('error', 'disabled');

    return redirectWithCookies(login.toString(), pendingCookies);
  }

  const profile = await getOrCreateUserProfile({
    uid: user.id,
    email: user.email ?? null,
    displayName:
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      null,
    photoURL:
      user.user_metadata?.avatar_url ||
      user.user_metadata?.picture ||
      null,
  });

  const destination =
    profile.role === 'admin' || profile.role === 'staff'
      ? '/admin'
      : '/admin/pending';

  return redirectWithCookies(
    `${origin}${destination}`,
    pendingCookies
  );
}
