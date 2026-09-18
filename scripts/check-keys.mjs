// Prints only the non-secret claims (ref / role / exp) of the Supabase keys in
// .env so you can confirm NEXT_PUBLIC_SUPABASE_URL points at the right project.
// It never prints the keys themselves.

import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, '')])
);

const url = env.NEXT_PUBLIC_SUPABASE_URL || '';
const urlRef = url.replace(/^https?:\/\//, '').split('.')[0];
console.log(`URL project ref : ${urlRef} (${urlRef.length} chars, expected 20)`);

for (const name of ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) {
  const token = env[name];
  if (!token) {
    console.log(`${name}: missing`);
    continue;
  }
  const parts = token.split('.');
  if (parts.length !== 3) {
    console.log(`${name}: not a JWT (new-style publishable/secret key?)`);
    continue;
  }
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    console.log(
      `${name}: ref=${payload.ref} role=${payload.role} exp=${new Date(payload.exp * 1000)
        .toISOString()
        .slice(0, 10)}`
    );
  } catch {
    console.log(`${name}: payload could not be decoded`);
  }
}
