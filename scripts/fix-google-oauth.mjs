// Fixes "Unable to exchange external code".
//
// Add to .env (temporarily), then run: node scripts/fix-google-oauth.mjs
//
//   GOOGLE_OAUTH_CLIENT_ID=631228962202-....apps.googleusercontent.com
//   GOOGLE_OAUTH_CLIENT_SECRET=GOCSPX-...
//   SUPABASE_ACCESS_TOKEN=sbp_...        # optional, only to auto-apply
//
// Step 1 always runs and proves whether the ID+secret pair is valid at Google.
// Step 2 runs only if SUPABASE_ACCESS_TOKEN is present, and writes the pair
// into the Supabase Google provider for you.
//
// Secrets are never printed - only lengths and verdicts.

import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, '')])
);

const clientId = env.GOOGLE_OAUTH_CLIENT_ID;
const clientSecret = env.GOOGLE_OAUTH_CLIENT_SECRET;
const pat = env.SUPABASE_ACCESS_TOKEN;
const projectRef = (env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/^https?:\/\//, '').split('.')[0];

if (!clientId || !clientSecret) {
  console.log('\nMissing GOOGLE_OAUTH_CLIENT_ID and/or GOOGLE_OAUTH_CLIENT_SECRET in .env\n');
  process.exit(1);
}

console.log('\nInput');
console.log('  client_id     :', clientId);
console.log('  client_secret : [' + clientSecret.length + ' chars]', clientSecret.startsWith('GOCSPX-') ? '(GOCSPX- prefix ok)' : '(!! does not start with GOCSPX-)');
console.log('  project ref   :', projectRef);

// ---------------------------------------------------------------------------
// Step 1: is this ID + secret pair actually valid at Google?
//
// Exchange a deliberately bogus authorization code:
//   invalid_client -> the ID/secret pair is WRONG
//   invalid_grant  -> the pair is CORRECT (only the code was bad)
// ---------------------------------------------------------------------------

const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    code: 'deliberately-invalid-code',
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: `https://${projectRef}.supabase.co/auth/v1/callback`,
    grant_type: 'authorization_code',
  }),
});

const tokenBody = await tokenRes.json().catch(() => ({}));
const googleError = tokenBody.error || '(none)';

console.log('\nStep 1 - credential test at Google');
console.log('  google says   :', googleError, tokenBody.error_description ? `(${tokenBody.error_description})` : '');

let credentialsGood = false;
if (googleError === 'invalid_grant') {
  credentialsGood = true;
  console.log('  VERDICT       : client_id + client_secret are VALID');
  console.log('                  (Google only rejected the fake code, as expected)');
} else if (googleError === 'invalid_client') {
  console.log('  VERDICT       : client_id + client_secret are WRONG or mismatched');
  console.log('                  Generate a new secret in Google Cloud for THIS client id.');
} else {
  console.log('  VERDICT       : unexpected response, see above');
}

// ---------------------------------------------------------------------------
// Step 2: write the verified pair into Supabase (needs a personal access token)
// ---------------------------------------------------------------------------

if (!credentialsGood) {
  console.log('\nNot touching Supabase while the credentials are invalid.\n');
  process.exit(1);
}

if (!pat) {
  console.log('\nStep 2 - skipped (no SUPABASE_ACCESS_TOKEN in .env)');
  console.log('Paste this verified secret into Supabase -> Authentication -> Providers -> Google,');
  console.log('or add a token from https://supabase.com/dashboard/account/tokens and re-run.\n');
  process.exit(0);
}

const api = `https://api.supabase.com/v1/projects/${projectRef}/config/auth`;
const headers = { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' };

const before = await fetch(api, { headers });
if (!before.ok) {
  console.log(`\nStep 2 - FAILED to read auth config: HTTP ${before.status} ${await before.text()}\n`);
  process.exit(1);
}
const beforeJson = await before.json();
console.log('\nStep 2 - current Supabase Google provider');
console.log('  enabled       :', beforeJson.external_google_enabled);
console.log('  client_id     :', beforeJson.external_google_client_id || '(empty)');
console.log('  matches input :', beforeJson.external_google_client_id === clientId);

const patch = await fetch(api, {
  method: 'PATCH',
  headers,
  body: JSON.stringify({
    external_google_enabled: true,
    external_google_client_id: clientId,
    external_google_secret: clientSecret,
  }),
});

if (!patch.ok) {
  console.log(`  PATCH failed  : HTTP ${patch.status} ${await patch.text()}\n`);
  process.exit(1);
}

const after = await patch.json();
console.log('  PATCH         : OK');
console.log('  now enabled   :', after.external_google_enabled);
console.log('  now client_id :', after.external_google_client_id);
console.log('\nDone. Retry the login, then run: node scripts/check-auth.mjs\n');
