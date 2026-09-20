import { useEffect, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
import { decodeJwtSessionId, isValidCliAuthParams, stashPendingCliAuth } from "@/lib/cliAuth";

/**
 * Where `feedbackkit login` sends the user's browser. Hands the CLI the
 * *current* Supabase session (access + refresh token) rather than minting a
 * separate credential — see supabase/migrations/0007_cli_sessions.sql for
 * why, and cli/src/commands/login.ts for the other end of this handshake.
 */
export function CliAuthPage() {
  const { user, loading } = useAuth();
  const [params] = useSearchParams();
  const port = params.get("port");
  const state = params.get("state");
  const label = params.get("label") || "a command-line tool";
  const paramsValid = isValidCliAuthParams(port, state);

  const [status, setStatus] = useState<"idle" | "authorizing" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  // Tracks whether the pending-auth stash below has actually run, so the
  // redirect to /login (further down) can't fire before it — see the
  // effect/render ordering note there.
  const [stashedForLogin, setStashedForLogin] = useState(false);

  useEffect(() => {
    if (loading || user || !paramsValid) return;
    // Bounced to /login to sign in first; come straight back here afterward.
    stashPendingCliAuth({ port: port!, state: state!, label });
    setStashedForLogin(true);
  }, [loading, user, paramsValid, port, state, label]);

  if (loading) {
    return <CenteredMessage>Loading…</CenteredMessage>;
  }

  if (!paramsValid) {
    return (
      <CenteredMessage>
        This link is missing information it needs (
        <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs">port</code> /{" "}
        <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs">state</code>). Make sure
        you're following a link that <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs">feedbackkit login</code>{" "}
        just printed, not a bookmarked or pasted one.
      </CenteredMessage>
    );
  }

  if (!user) {
    // Wait for the stash effect above to actually run before navigating
    // away, so /login's redirect-back logic has somewhere to send us.
    if (!stashedForLogin) return <CenteredMessage>Redirecting you to sign in…</CenteredMessage>;
    return <Navigate to="/login" replace />;
  }

  async function authorize() {
    setStatus("authorizing");
    setError(null);
    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const session = data.session;
      if (!session) throw new Error("No active session — try signing in again.");

      const sessionId = decodeJwtSessionId(session.access_token);
      const { error: insertError } = await supabase.from("cli_sessions").insert({
        user_id: session.user.id,
        session_id: sessionId,
        label,
      });
      if (insertError) throw insertError;

      const callback = new URL(`http://127.0.0.1:${port}/callback`);
      callback.searchParams.set("state", state!);
      callback.searchParams.set("access_token", session.access_token);
      callback.searchParams.set("refresh_token", session.refresh_token);
      callback.searchParams.set("expires_at", String(session.expires_at ?? ""));
      // So the CLI doesn't need its own separate Supabase configuration.
      callback.searchParams.set("supabase_url", SUPABASE_URL);
      callback.searchParams.set("supabase_anon_key", SUPABASE_ANON_KEY);

      setStatus("done");
      window.location.href = callback.toString();
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Link to="/" className="text-2xl font-semibold tracking-tight text-neutral-900">
            FeedbackKit
          </Link>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
          <h1 className="text-base font-semibold text-neutral-900">Authorize CLI access</h1>
          <p className="mt-2 text-sm text-neutral-600">
            <span className="font-medium text-neutral-900">{label}</span> wants to access your
            FeedbackKit account — signed in as{" "}
            <span className="font-medium text-neutral-900">{user.email}</span>. It'll be able to
            read feedback and generated prompts for projects you're a member of.
          </p>
          <p className="mt-2 text-xs text-neutral-500">
            Only continue if you just ran <code className="rounded bg-neutral-100 px-1 py-0.5">feedbackkit login</code> in
            your own terminal.
          </p>

          {error ? (
            <div className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          ) : null}

          <div className="mt-5 flex gap-3">
            <button
              type="button"
              disabled={status === "authorizing" || status === "done"}
              onClick={authorize}
              className="flex-1 rounded-md bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              {status === "authorizing" || status === "done" ? "Authorizing…" : "Authorize"}
            </button>
            <Link
              to="/projects"
              className="flex-1 rounded-md border border-neutral-300 px-4 py-2.5 text-center text-sm font-medium text-neutral-900 hover:bg-neutral-50"
            >
              Cancel
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-neutral-400">
          Manage or revoke connected CLIs anytime from{" "}
          <Link to="/cli-sessions" className="underline hover:text-neutral-700">
            CLI access
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 text-center text-sm text-neutral-500">
      {children}
    </div>
  );
}
