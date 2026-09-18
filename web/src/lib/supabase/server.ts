import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Server Component / Server Action / Route Handler Supabase client, bound to the request's auth cookies. */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component with no request/response to write to;
            // fine as long as middleware.ts is refreshing the session on navigation.
          }
        },
      },
    },
  );
}
