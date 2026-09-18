// Confirms whether the schema from supabase/migrations/0001_init.sql really
// exists, by doing a plain select (not a head/count request) as service role.

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, '')])
);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

for (const table of [
  'profiles',
  'settings',
  'categories',
  'menu_items',
  'activity_logs',
  'orders',
  'order_items',
  'daily_sales_summaries',
  'costs',
]) {
  const { data, error } = await admin.from(table).select('*').limit(1);
  console.log(
    error ? `MISSING ${table}: [${error.code}] ${error.message}` : `ok      ${table} (${data.length} sample row)`
  );
}
