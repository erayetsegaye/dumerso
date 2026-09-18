import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { isSupabaseAdminConfigured } from '@/lib/supabase/config';

export { isSupabaseConfigured, isSupabaseAdminConfigured } from '@/lib/supabase/config';

let cachedAdmin: SupabaseClient | null = null;

/** Service-role client. Bypasses RLS. Server-only — never import from client components. */
export function getAdminClient(): SupabaseClient {
  if (!isSupabaseAdminConfigured()) {
    throw new Error(
      'Supabase is not configured on the server yet. Add NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY (see .env.example).'
    );
  }

  if (!cachedAdmin) {
    cachedAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }

  return cachedAdmin;
}

export const MENU_IMAGES_BUCKET = 'menu-images';
