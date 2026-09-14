import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/db';

const JWT_SECRET = process.env.JWT_SECRET || 'dumerso-cafe-secret-key-2026';

export async function GET() {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('admin_token')?.value;

    if (!token) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; username: string };
    const admin = await prisma.adminUser.findUnique({
      where: { id: decoded.id },
      select: { id: true, username: true, createdAt: true },
    });

    if (!admin) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({ authenticated: true, user: admin });
  } catch (error) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}
