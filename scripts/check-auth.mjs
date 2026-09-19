// Diagnoses "login keeps failing": checks which providers Supabase has
// enabled, which users/profiles exist, and whether BOOTSTRAP_ADMIN_EMAILS
// can actually match. Emails are masked.

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, '')])
);

const mask = (email) => {
  if (!email) return '(none)';
  const [user, domain] = email.split('@');
  return `${user.slice(0, 2)}***@${domain ?? '?'}`;
};

const url = env.NEXT_PUBLIC_SUPABASE_URL;

console.log('\n--- Auth providers enabled on the project ---');
const settings = await fetch(`${url}/auth/v1/settings`, {
  headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY },
}).then((r) => r.json());

console.log('google  :', settings.external?.google === true ? 'ENABLED' : 'DISABLED  <-- sign-in cannot work');
console.log('email   :', settings.external?.email === true ? 'enabled' : 'disabled');
console.log('signups :', settings.disable_signup ? 'DISABLED' : 'allowed');

const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

console.log('\n--- auth.users ---');
const { data: list, error: listError } = await admin.auth.admin.listUsers({ perPage: 50 });
if (listError) console.log('error:', listError.message);
else if (!list.users.length) console.log('(no users have ever completed sign-in)');
else
  list.users.forEach((u) =>
    console.log(
      `${mask(u.email)} | provider=${u.app_metadata?.provider} | confirmed=${Boolean(
        u.email_confirmed_at
      )} | created=${u.created_at.slice(0, 19)}`
    )
  );

console.log('\n--- public.profiles ---');
const { data: profiles } = await admin.from('profiles').select('email, role, disabled');
if (!profiles?.length) console.log('(empty)');
else profiles.forEach((p) => console.log(`${mask(p.email)} | role=${p.role} | disabled=${p.disabled}`));

console.log('\n--- bootstrap admin config ---');
const boots = (env.BOOTSTRAP_ADMIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);
console.log('BOOTSTRAP_ADMIN_EMAILS:', boots.map(mask).join(', ') || '(empty)');
boots.forEach((e) => {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) console.log(`  !! "${mask(e)}" is not a valid email`);
  if (e !== e.trim() || /\s/.test(e)) console.log(`  !! "${mask(e)}" has stray whitespace`);
});
console.log('SIGNUP_INVITE_CODE    :', env.SIGNUP_INVITE_CODE ? 'set (required for non-bootstrap signups)' : 'not set');
console.log('NEXT_PUBLIC_SITE_URL  :', env.NEXT_PUBLIC_SITE_URL);
console.log(
  '\nA Google account NOT in BOOTSTRAP_ADMIN_EMAILS that signs in at /admin/login\n' +
    '(no invite cookie) is deleted again and bounced back with ?error=invite.\n'
);
