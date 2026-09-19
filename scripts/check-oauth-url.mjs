// Shows exactly what Supabase sends to Google when you click "Continue with
// Google". Compare these values with your Google Cloud OAuth client.

import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, '')])
);

const base = env.NEXT_PUBLIC_SUPABASE_URL;
const appCallback = `${env.NEXT_PUBLIC_SITE_URL}/auth/callback`;

const res = await fetch(
  `${base}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(appCallback)}`,
  { redirect: 'manual', headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY } }
);

const location = res.headers.get('location');
console.log(`\nSupabase authorize -> HTTP ${res.status}`);

if (!location) {
  console.log('No redirect returned. Body:', (await res.text()).slice(0, 400));
  process.exit(1);
}

if (!location.includes('accounts.google.com')) {
  console.log('Did not redirect to Google. Location:', location.slice(0, 400));
  process.exit(1);
}

const params = new URL(location).searchParams;
console.log('\nWhat Google receives:');
console.log('  client_id    :', params.get('client_id'));
console.log('  redirect_uri :', params.get('redirect_uri'));
console.log('  scope        :', params.get('scope'));
console.log('\nYour Google Cloud OAuth client MUST list this exact redirect URI:');
console.log(`  ${params.get('redirect_uri')}`);
console.log('\nAnd the client_id above must be that same OAuth client.\n');
