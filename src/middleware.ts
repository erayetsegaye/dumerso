import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Gate-keeps the whole admin area.
 *
 * Middleware runs on the Edge runtime, where `jsonwebtoken` is not available,
 * so here we only check that the session cookie exists (cheap + fast).
 * The real signature check happens in `/api/auth/me`, which the admin layout
 * calls on every page load.
 */
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get('admin_token')?.value);

  // Already signed in? Skip the login screen.
  if (pathname === '/admin/login') {
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
