import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { peekPendingCliAuth, clearPendingCliAuth } from "@/lib/cliAuth";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- context + hook + guards are one cohesive unit
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

/**
 * Client-side stand-in for the old `src/proxy.ts` middleware redirect: sends
 * signed-out visitors to /login. Since this is a static SPA there's no
 * request to intercept, so unlike middleware this can't stop the protected
 * page's shell from ever rendering — there's a brief loading state instead
 * of a hard redirect before any HTML ships.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <AuthLoadingScreen />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

/**
 * Signed-in visitors hitting /login are sent to /projects — unless they were
 * on their way to authorize a CLI login (see cliAuth.ts) when they got
 * bounced here to sign in, in which case they're sent back to finish that
 * instead.
 */
export function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  // Computed (and the sessionStorage entry cleared) at most once per
  // sign-in, cached in a ref rather than a plain variable or effect. This
  // is React's documented pattern for a one-time side effect during
  // render: a `useEffect` here raced against <Navigate>'s own internal
  // effect (child effects fire before parent effects, and <Navigate>'s
  // fires a real navigation that can unmount this component first), and a
  // plain destructive read during render broke under StrictMode's
  // intentional double-invoke — the second invocation saw it already
  // cleared by the first and silently fell back to /projects. A ref
  // survives both invocations, so the second one just reuses the cached
  // result instead of reading (and clearing) sessionStorage again.
  const redirectTarget = useRef<string | undefined>(undefined);
  if (!loading && user && redirectTarget.current === undefined) {
    const pending = peekPendingCliAuth();
    if (pending) {
      clearPendingCliAuth();
      const params = new URLSearchParams({
        port: pending.port,
        state: pending.state,
        label: pending.label,
      });
      redirectTarget.current = `/cli-auth?${params.toString()}`;
    } else {
      redirectTarget.current = "/projects";
    }
  }

  if (loading) return <AuthLoadingScreen />;
  if (user) return <Navigate to={redirectTarget.current ?? "/projects"} replace />;
  return <>{children}</>;
}

function AuthLoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-neutral-400">
      Loading…
    </div>
  );
}
