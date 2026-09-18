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

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const { userId, response } = await updateSession(request);
  const hasSession = Boolean(userId);
  const isPublicPath = PUBLIC_ADMIN_PATHS.includes(pathname);

  if (isPublicPath) {
    if (hasSession) {
      const redirect = NextResponse.redirect(new URL('/admin', request.url));
      response.cookies.getAll().forEach((cookie) => {
        redirect.cookies.set(cookie.name, cookie.value);
      });
      return redirect;
    }
    return response;
  }

  if (!hasSession) {
    const loginUrl = new URL('/admin/login', request.url);
    loginUrl.searchParams.set('from', `${pathname}${search}`);
    const redirect = NextResponse.redirect(loginUrl);
    response.cookies.getAll().forEach((cookie) => {
      redirect.cookies.set(cookie.name, cookie.value);
    });
    return redirect;
  }

  return response;
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
};
