import { createClient } from "@supabase/supabase-js";

// The anon/publishable key and project URL — safe to expose in a client
// bundle (same values `web/.env.local`/CI variables provide), and handed to
// the CLI at browser-login time (CliAuthPage.tsx) so `feedbackkit login`
// doesn't need its own copy of them configured separately.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Single browser Supabase client for the whole app. There's no server here
 * (static SPA), so auth is entirely client-side: supabase-js persists the
 * session to localStorage and refreshes it automatically. RLS is what
 * actually enforces tenancy — see supabase/migrations/0001_init.sql.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
