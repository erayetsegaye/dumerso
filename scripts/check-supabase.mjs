// Pre-deploy health check for the Supabase backend.
// Usage: node scripts/check-supabase.mjs
// Reads .env (never prints secret values) and verifies schema, seed data,
// storage bucket and auth settings the app depends on.

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadEnv(file = '.env') {
  try {
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/);
      if (!match) continue;
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      if (!process.env[match[1]]) process.env[match[1]] = value;
    }
  } catch {
    // no .env file - rely on the real environment
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

const required = {
  NEXT_PUBLIC_SUPABASE_URL: url,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: anon,
  SUPABASE_SERVICE_ROLE_KEY: service,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  BOOTSTRAP_ADMIN_EMAILS: process.env.BOOTSTRAP_ADMIN_EMAILS,
};

let failures = 0;
const ok = (msg) => console.log(`  ok    ${msg}`);
const warn = (msg) => console.log(`  warn  ${msg}`);
const bad = (msg) => {
  failures += 1;
  console.log(`  FAIL  ${msg}`);
};

console.log('\nEnvironment');
for (const [name, value] of Object.entries(required)) {
  if (value) ok(`${name} set`);
  else bad(`${name} missing`);
}
if (process.env.SIGNUP_INVITE_CODE) ok('SIGNUP_INVITE_CODE set');
else warn('SIGNUP_INVITE_CODE not set - any Google account can create a pending account');

if (!url || !service) {
  console.log('\nCannot reach Supabase without URL + service role key.\n');
  process.exit(1);
}

const admin = createClient(url, service, { auth: { persistSession: false } });

const TABLES = [
  'profiles',
  'settings',
  'categories',
  'menu_items',
  'activity_logs',
  'orders',
  'order_items',
  'daily_sales_summaries',
  'costs',
];

console.log('\nSchema (service role)');
for (const table of TABLES) {
  const { count, error } = await admin.from(table).select('*', { count: 'exact', head: true });
  if (error) bad(`${table}: ${error.message}`);
  else ok(`${table}: ${count ?? 0} rows`);
}

console.log('\nRow Level Security (anon key must be blocked)');
if (anon) {
  const publicClient = createClient(url, anon, { auth: { persistSession: false } });
  for (const table of ['profiles', 'orders', 'menu_items']) {
    const { data, error } = await publicClient.from(table).select('*').limit(1);
    if (error) ok(`${table}: blocked (${error.code || 'error'})`);
    else if (!data?.length) warn(`${table}: empty result, RLS likely on but unverified`);
    else bad(`${table}: readable with the anon key - enable RLS`);
  }
} else {
  bad('anon key missing, cannot test RLS');
}

console.log('\nStorage');
const { data: buckets, error: bucketError } = await admin.storage.listBuckets();
if (bucketError) {
  bad(`listBuckets: ${bucketError.message}`);
} else {
  const bucket = buckets.find((b) => b.id === 'menu-images');
  if (!bucket) bad('bucket "menu-images" missing - run migrations/0001_init.sql');
  else if (!bucket.public) bad('bucket "menu-images" is not public - menu photos will 404');
  else ok('bucket "menu-images" exists and is public');
}

console.log('\nAuth');
const { data: users, error: userError } = await admin.auth.admin.listUsers({ perPage: 1 });
if (userError) bad(`auth admin API: ${userError.message}`);
else ok(`auth admin API reachable (${users.users.length ? 'has users' : 'no users yet'})`);

console.log(failures ? `\n${failures} check(s) failed.\n` : '\nAll checks passed.\n');
process.exit(failures ? 1 : 0);
