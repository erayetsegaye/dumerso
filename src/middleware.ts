import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

/**
 * Gate-keeps the whole admin area.
 *
 * Middleware only checks that a Supabase session exists. Real verification
 * and the role check happen in `/api/auth/me`, which the admin layout calls
 * on every page load.
 */
const PUBLIC_ADMIN_PATHS = ['/admin/login', '/admin/signup'];

/**
 * Deletes a cookie for real. `maxAge: 0` on its own is dropped by Next's
 * serialiser, which blanks the cookie instead of removing it. Duplicated from
 * lib/auth.ts on purpose: that module pulls in next/headers, which middleware
 * cannot import.
 */
const DELETE_COOKIE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 0,
  expires: new Date(0),
  path: '/',
} as const;

/**
 * Removes blank Supabase cookies left behind by an older build.
 *
 * An empty HttpOnly `...-code-verifier` cookie is unrecoverable from the
 * browser: the Supabase client writes the verifier with document.cookie, and
 * JavaScript may not overwrite an HttpOnly cookie, so every sign-in fails with
 * pkce_code_verifier_not_found. The server has no such restriction, so clear
 * them here - before the user reaches the sign-in button.
 */
function dropBlankSupabaseCookies(request: NextRequest, response: NextResponse): void {
  request.cookies.getAll().forEach((cookie) => {
    if (cookie.name.startsWith('sb-') && cookie.value === '') {
      response.cookies.set(cookie.name, '', DELETE_COOKIE);
    }
  });
}

/**
 * Moves refreshed Supabase cookies onto a redirect, keeping every attribute.
 * Copying only name/value loses Path and the browser re-scopes the cookie to
 * /admin, leaving a stale duplicate that shadows the real session.
 */
function withRefreshedCookies(redirect: NextResponse, source: NextResponse): NextResponse {
  source.cookies.getAll().forEach((cookie) => {
    redirect.cookies.set(cookie);
  });
  return redirect;
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const { userId, response } = await updateSession(request);
  const hasSession = Boolean(userId);
  const isPublicPath = PUBLIC_ADMIN_PATHS.includes(pathname);

  dropBlankSupabaseCookies(request, response);

  if (isPublicPath) {
    if (hasSession) {
      return withRefreshedCookies(NextResponse.redirect(new URL('/admin', request.url)), response);
    }
    return response;
  }

  if (!hasSession) {
    const loginUrl = new URL('/admin/login', request.url);
    loginUrl.searchParams.set('from', `${pathname}${search}`);
    return withRefreshedCookies(NextResponse.redirect(loginUrl), response);
  }

  return response;
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
};
