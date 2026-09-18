# Supabase setup (owner of this cafe app)

This app no longer uses Firebase or a local SQLite file. Create **your own**
Supabase project, then point this Next.js app at it with environment variables.
Do not reuse someone else’s project.

The Next.js server talks to the database with the **service role** key. The
browser only uses the public anon key for Google sign-in.

## 1. Create a project

1. Open [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. New project → wait until it is ready

## 2. Run SQL

In **SQL Editor**:

1. Paste and run [`migrations/0001_init.sql`](migrations/0001_init.sql)
2. Paste and run [`seed.sql`](seed.sql) (menu starter data)

## 3. Enable Google sign-in

1. **Authentication → Providers → Google** → enable
2. Create OAuth credentials in Google Cloud (Web application)
3. Authorized redirect URI from Supabase (shown on that provider page)
4. Paste the Google client ID and secret into Supabase

In **Authentication → URL configuration**, add:

- `http://localhost:3000/auth/callback`
- `https://YOUR-PRODUCTION-DOMAIN/auth/callback`

## 4. Environment variables

Copy `.env.example` to `.env` in the project root:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SIGNUP_INVITE_CODE=change-this
BOOTSTRAP_ADMIN_EMAILS=you@example.com
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Keys: **Project Settings → API**. The service role key is a secret — never
prefix it with `NEXT_PUBLIC_`.

`BOOTSTRAP_ADMIN_EMAILS` is the Google account that becomes admin on first
sign-in (no invite needed). Everyone else needs `SIGNUP_INVITE_CODE` and then
admin approval.

## 5. Run the app

```
npm install
npm run dev
```

Open `http://localhost:3000`. Staff use `/admin/login`.

## Deploy

This is a full Next.js server (API routes + middleware). Host it on Vercel or
any Node host, and set the same env vars there. Update `NEXT_PUBLIC_SITE_URL`
and the Supabase redirect URLs to the live origin.

Do **not** use Firebase Hosting or a static `out/` export.
