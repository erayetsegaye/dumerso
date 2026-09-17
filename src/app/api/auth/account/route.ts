import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';

const JWT_SECRET = process.env.JWT_SECRET || 'dumerso-cafe-secret-key-2026';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Update the signed-in admin's email address (confirmed with the password). */
export async function PUT(request: Request) {
  try {
    const token = cookies().get('admin_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
    const { email, currentPassword } = await request.json();

    if (!email || !currentPassword) {
      return NextResponse.json(
        { error: 'Email and your current password are required' },
        { status: 400 }
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
    }

    const admin = await prisma.adminUser.findUnique({ where: { id: decoded.id } });
    if (!admin) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const isMatch = await bcrypt.compare(currentPassword, admin.password);
    if (!isMatch) {
      return NextResponse.json({ error: 'Password is incorrect' }, { status: 400 });
    }

    const taken = await prisma.adminUser.findFirst({
      where: { email: normalizedEmail, id: { not: admin.id } },
      select: { id: true },
    });
    if (taken) {
      return NextResponse.json(
        { error: 'That email is already used by another admin' },
        { status: 409 }
      );
    }

    const updated = await prisma.adminUser.update({
      where: { id: admin.id },
      data: { email: normalizedEmail },
      select: { id: true, username: true, email: true },
    });

    await prisma.activityLog.create({
      data: {
        action: 'Admin email updated',
        details: `Account "${updated.username}" email set to ${updated.email}`,
        type: 'update',
      },
    });

    return NextResponse.json({ message: 'Email updated successfully', user: updated });
  } catch (error) {
    console.error('API Account PUT error:', error);
    return NextResponse.json({ error: 'Failed to update email' }, { status: 500 });
  }
}
