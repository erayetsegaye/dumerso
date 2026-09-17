/**
 * Create or update the admin sign-in credentials.
 *
 *   npm run admin:set -- --email=owner@example.com --generate
 *   npm run admin:set -- --email=owner@example.com --password="my secret"
 *   npm run admin:set -- --username=owner --password="my secret"
 *
 * Credentials can also come from the environment (handy for CI / hosting),
 * so they never end up in your shell history:
 *   ADMIN_EMAIL, ADMIN_USERNAME, ADMIN_PASSWORD
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

const PASSWORD_ALPHABET =
  'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789-_@#%+=';

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const match = process.argv.find((a) => a.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

/** Uniform random password (rejection sampling avoids modulo bias). */
function generatePassword(length = 20): string {
  const limit = Math.floor(256 / PASSWORD_ALPHABET.length) * PASSWORD_ALPHABET.length;
  let out = '';
  while (out.length < length) {
    for (const byte of crypto.randomBytes(length)) {
      if (byte < limit) {
        out += PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length];
        if (out.length === length) break;
      }
    }
  }
  return out;
}

async function main() {
  const username = (getArg('username') || process.env.ADMIN_USERNAME || 'admin').trim();
  const emailInput = (getArg('email') || process.env.ADMIN_EMAIL || '').trim();
  const email = emailInput ? emailInput.toLowerCase() : undefined;
  const wantsGenerated = process.argv.includes('--generate');

  let password = getArg('password') || process.env.ADMIN_PASSWORD || '';
  let generated = false;

  if (!password && wantsGenerated) {
    password = generatePassword();
    generated = true;
  }

  if (!email && !password) {
    throw new Error(
      'Nothing to do. Pass --email=..., --password=... or --generate ' +
        '(see the comment at the top of prisma/set-admin.ts).'
    );
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw new Error(`"${emailInput}" is not a valid email address.`);
  }

  if (password && password.length < 8) {
    throw new Error('Password must be at least 8 characters long.');
  }

  // Refuse to hand the account an email that belongs to somebody else.
  if (email) {
    const clash = await prisma.adminUser.findFirst({
      where: { email, username: { not: username } },
      select: { username: true },
    });
    if (clash) {
      throw new Error(`${email} is already used by admin "${clash.username}".`);
    }
  }

  const existing = await prisma.adminUser.findUnique({ where: { username } });
  const passwordHash = password ? await bcrypt.hash(password, 12) : undefined;

  if (!existing && !passwordHash) {
    throw new Error(
      `Admin "${username}" does not exist yet, so a password is required. ` +
        'Add --generate or --password=...'
    );
  }

  const admin = existing
    ? await prisma.adminUser.update({
        where: { username },
        data: {
          ...(email ? { email } : {}),
          ...(passwordHash ? { password: passwordHash } : {}),
        },
      })
    : await prisma.adminUser.create({
        data: { username, email, password: passwordHash as string },
      });

  await prisma.activityLog.create({
    data: {
      action: existing ? 'Admin credentials updated' : 'Admin account created',
      details: `Account "${admin.username}"${admin.email ? ` (${admin.email})` : ''}${
        passwordHash ? ' — password changed' : ''
      }`,
      type: 'update',
    },
  });

  console.log(`\n✅ ${existing ? 'Updated' : 'Created'} admin account`);
  console.log(`   Username : ${admin.username}`);
  console.log(`   Email    : ${admin.email ?? '(none)'}`);
  console.log(`   Password : ${generated ? password : passwordHash ? '(updated)' : '(unchanged)'}`);
  if (generated) {
    console.log('\n⚠️  Copy the generated password now — it is not stored anywhere in plain text.');
  }
  console.log('\nSign in at /admin/login with either the username or the email.\n');
}

main()
  .catch((error) => {
    console.error(`\n❌ ${error instanceof Error ? error.message : error}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
