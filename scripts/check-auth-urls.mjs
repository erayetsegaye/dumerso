// Shows the Supabase Auth URL configuration (site URL + redirect allow list),
// which decides where users may be sent back to after Google sign-in.
// Needs SUPABASE_ACCESS_TOKEN in .env.

import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, '')])
);

const ref = (env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/^https?:\/\//, '').split('.')[0];
const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
  headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}` },
});

if (!res.ok) {
  console.log(`HTTP ${res.status}: ${await res.text()}`);
  process.exit(1);
}

const cfg = await res.json();
const allow = (cfg.uri_allow_list || '').split(',').map((s) => s.trim()).filter(Boolean);
const needed = `${env.NEXT_PUBLIC_SITE_URL}/auth/callback`;

console.log('\nSupabase Auth URL configuration');
console.log('  site_url       :', cfg.site_url || '(empty)');
console.log('  uri_allow_list :', allow.length ? allow.join('\n                   ') : '(empty)');

const matches = (pattern, value) => {
  const rx = new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
  return rx.test(value);
};

const covered = allow.some((p) => matches(p, needed)) || cfg.site_url === env.NEXT_PUBLIC_SITE_URL;
console.log('\n  app callback   :', needed);
console.log('  allowed        :', covered ? 'YES' : 'NO  <-- add it, or sign-in will bounce to site_url');
console.log('\n  external_google_enabled:', cfg.external_google_enabled);
console.log('  disable_signup         :', cfg.disable_signup);
console.log();
