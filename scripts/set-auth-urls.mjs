// Adds a deployment origin to the Supabase Auth redirect allow list without
// dropping the existing entries.
//
//   node scripts/set-auth-urls.mjs https://dumerso.vercel.app
//
// Needs SUPABASE_ACCESS_TOKEN in .env. Prints the config before and after.

import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, '')])
);

const origin = (process.argv[2] || '').replace(/\/$/, '');
if (!origin) {
  console.log('\nUsage: node scripts/set-auth-urls.mjs https://your-app.vercel.app\n');
  process.exit(1);
}

const ref = (env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/^https?:\/\//, '').split('.')[0];
const api = `https://api.supabase.com/v1/projects/${ref}/config/auth`;
const headers = {
  Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`,
  'Content-Type': 'application/json',
};

const current = await fetch(api, { headers });
if (!current.ok) {
  console.log(`\nHTTP ${current.status}: ${await current.text()}\n`);
  process.exit(1);
}

const cfg = await current.json();
const existing = (cfg.uri_allow_list || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

console.log('\nBefore');
console.log('  site_url       :', cfg.site_url || '(empty)');
console.log('  uri_allow_list :', existing.join(', ') || '(empty)');

// Keep localhost for local development, add the deployment callback.
const wanted = Array.from(new Set([...existing, `${origin}/auth/callback`]));

const patch = await fetch(api, {
  method: 'PATCH',
  headers,
  body: JSON.stringify({
    site_url: origin,
    uri_allow_list: wanted.join(','),
  }),
});

if (!patch.ok) {
  console.log(`\nPATCH failed - HTTP ${patch.status}: ${await patch.text()}\n`);
  process.exit(1);
}

const after = await patch.json();
console.log('\nAfter');
console.log('  site_url       :', after.site_url);
console.log(
  '  uri_allow_list :',
  (after.uri_allow_list || '').split(',').join('\n                   ')
);
console.log();
