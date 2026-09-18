import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Gate-keeps the whole admin area.
 *
 * Middleware runs on the Edge runtime, where firebase-admin cannot verify a
 * session, so this only checks that a session cookie exists (cheap + fast).
 * Real verification and the role check happen in `/api/auth/me`, which the
 * admin layout calls on every page load.
 */
const PUBLIC_ADMIN_PATHS = ['/admin/login', '/admin/signup'];

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get('admin_session')?.value);

  const isPublicPath = PUBLIC_ADMIN_PATHS.includes(pathname);

  // Already signed in? Skip the sign-in screens.
  if (isPublicPath) {
    if (hasSession) {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
    return NextResponse.next();
  }

  // Any other /admin page requires a session.
  if (!hasSession) {
    const loginUrl = new URL('/admin/login', request.url);
    loginUrl.searchParams.set('from', `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
};
