import { createClient } from "@supabase/supabase-js";

/**
 * Single browser Supabase client for the whole app. There's no server here
 * (static SPA), so auth is entirely client-side: supabase-js persists the
 * session to localStorage and refreshes it automatically. RLS is what
 * actually enforces tenancy — see supabase/migrations/0001_init.sql.
 */
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);
