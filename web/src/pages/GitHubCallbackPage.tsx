import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { finishGitHubUserConnect } from "@/lib/githubUser";

/** Where GitHub sends the browser back after "Connect GitHub for Copilot" (see lib/githubUser.ts). */
export function GitHubCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  // StrictMode runs effects twice in dev; a code can only be exchanged once.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const code = params.get("code");
    const state = params.get("state");
    if (!code || !state) {
      setError(params.get("error_description") ?? "GitHub didn't send an authorization code.");
      return;
    }
    finishGitHubUserConnect(code, state)
      .then(({ returnTo }) => navigate(returnTo, { replace: true }))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Couldn't connect your GitHub account."));
  }, [params, navigate]);

  return (
    <div className="mx-auto max-w-md py-16 text-center text-sm text-neutral-600">
      {error ? (
        <>
          <p className="text-red-600">{error}</p>
          <Link to="/projects" className="mt-4 inline-block text-neutral-900 underline">
            Back to projects
          </Link>
        </>
      ) : (
        <p>Connecting your GitHub account…</p>
      )}
    </div>
  );
}
