import { useState, useTransition } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Logomark } from "@/components/Logomark";
import { Button } from "@/components/Button";

export function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function signInWithGitHub() {
    setError(null);
    startTransition(async () => {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          // Land back on /login so RedirectIfAuthed forwards to /projects
          // once the session from the OAuth redirect is detected.
          redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}login`,
        },
      });
      // On success the browser navigates to GitHub immediately; this only
      // returns if kicking off the redirect itself failed.
      if (error) setError(error.message);
    });
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-neutral-50 px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-gradient-to-b from-violet-200/40 to-transparent blur-3xl"
      />
      <div className="relative w-full max-w-md space-y-8">
        <div className="flex flex-col items-center text-center">
          <Link to="/" className="flex items-center gap-2">
            <Logomark size={32} />
            <span className="text-2xl font-semibold tracking-tight text-neutral-900">FeedbackKit</span>
          </Link>
          <p className="mt-2 text-sm text-neutral-500">
            The dashboard for feedback captured by your iOS app.
          </p>
        </div>

        {error ? (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}

        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <Button disabled={isPending} onClick={signInWithGitHub} className="w-full">
            <GitHubMark className="h-4 w-4" />
            {isPending ? "Redirecting to GitHub…" : "Continue with GitHub"}
          </Button>
          <p className="mt-3 text-center text-xs text-neutral-400">
            First time here? Signing in creates your account automatically.
          </p>
        </div>

        <p className="text-center text-xs text-neutral-400">
          By continuing you agree to the{" "}
          <Link to="/terms" className="underline hover:text-neutral-700">
            user agreement
          </Link>{" "}
          and{" "}
          <Link to="/privacy" className="underline hover:text-neutral-700">
            privacy notice
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

function GitHubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}
