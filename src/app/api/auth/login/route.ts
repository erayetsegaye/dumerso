import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { legacyLoginEnabled } from '@/lib/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'dumerso-cafe-secret-key-2026';

/**
 * DEPRECATED username/password login, kept only so the cafe is not locked out
 * while Google sign-in is being set up. Disable it with
 * ALLOW_LEGACY_ADMIN_LOGIN=false in .env, then this route can be deleted.
 */
export async function POST(request: Request) {
  try {
    if (!legacyLoginEnabled()) {
      return NextResponse.json(
        { error: 'Password login is disabled. Please sign in with Google.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { password, remember = true } = body;

    // Accept a username or an email address in the same field.
    const identifier = String(body.identifier ?? body.username ?? body.email ?? '').trim();

    if (!identifier || !password) {
      return NextResponse.json(
        { error: 'Username/email and password are required' },
        { status: 400 }
      );
    }

    const admin = await prisma.adminUser.findFirst({
      where: {
        OR: [{ username: identifier }, { email: identifier.toLowerCase() }],
      },
    });

    if (!admin) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    const token = jwt.sign(
      { id: admin.id, username: admin.username },
      JWT_SECRET,
      { expiresIn: remember ? '7d' : '12h' }
    );

    const response = NextResponse.json({
      success: true,
      user: { id: admin.id, username: admin.username, email: admin.email },
    });

    response.cookies.set('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      // "Remember me" keeps the cookie for 7 days; otherwise it is a
      // session cookie that disappears when the browser closes.
      ...(remember ? { maxAge: 7 * 24 * 60 * 60 } : {}),
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('API Login error:', error);
    return NextResponse.json({ error: 'Authentication error' }, { status: 500 });
  }
}
