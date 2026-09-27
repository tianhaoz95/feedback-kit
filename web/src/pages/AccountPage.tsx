import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { getErrorMessage } from "@/lib/errors";
import { COMPANY_NAME, SUPPORT_EMAIL } from "@/lib/company";
import { disconnectGitHubUser, fetchGitHubUserConnection, type GitHubUserConnection } from "@/lib/githubUser";
import { Button } from "@/components/Button";

/**
 * Profile, connected GitHub account (for Copilot dispatch) and self-service
 * account deletion (supabase/migrations/0021_account_deletion.sql).
 */
export function AccountPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [connection, setConnection] = useState<GitHubUserConnection | null | undefined>(undefined);
  const [confirm, setConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchGitHubUserConnection()
      .then(setConnection)
      .catch(() => setConnection(null));
  }, []);

  const login = (user?.user_metadata?.user_name as string | undefined) ?? "";
  const confirmWord = login || "delete";

  async function deleteAccount() {
    setDeleting(true);
    setError(null);
    try {
      // Files of organizations that go with the account; the database can't
      // delete storage objects itself. Best effort, like DeleteProjectCard.
      const { data: paths } = await supabase.rpc("my_sole_organization_storage_paths");
      const list = ((paths ?? []) as string[]).filter(Boolean);
      for (let i = 0; i < list.length; i += 100) {
        await supabase.storage.from("feedback-screenshots").remove(list.slice(i, i + 100)).catch(() => {});
      }
      const { error: rpcError } = await supabase.rpc("delete_my_account");
      if (rpcError) throw rpcError;
      await supabase.auth.signOut().catch(() => {});
      navigate("/", { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't delete your account."));
      setDeleting(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Account</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Signed in with GitHub as <span className="font-medium text-neutral-700">{login || user?.email}</span>
          {user?.email && login ? ` (${user.email})` : ""}.
        </p>
      </div>

      <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-medium text-neutral-900">GitHub account for Copilot</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Lets &ldquo;Send to agent&rdquo; assign issues to GitHub Copilot as you. Connect it from a project&apos;s
          Settings → Coding agent loop.
        </p>
        <div className="mt-3 text-sm text-neutral-700">
          {connection === undefined ? (
            <span className="text-neutral-400">Checking…</span>
          ) : connection ? (
            <span className="flex items-center gap-3">
              Connected as {connection.github_login ?? "your GitHub account"}
              <button
                type="button"
                className="text-xs text-neutral-400 hover:text-neutral-700"
                onClick={() => void disconnectGitHubUser().then(() => setConnection(null))}
              >
                Disconnect
              </button>
            </span>
          ) : (
            <span className="text-neutral-500">Not connected.</span>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-red-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-medium text-red-700">Delete account</h2>
        <p className="mt-1 text-xs text-neutral-600">
          Permanently deletes your profile, memberships, CLI sessions, connected GitHub token and notifications,
          and every organization where you&apos;re the only member, with its projects, reports and screenshots.
          Organizations you share keep their data. This can&apos;t be undone. Questions:{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">
            {SUPPORT_EMAIL}
          </a>{" "}
          ({COMPANY_NAME}).
        </p>
        <label className="mt-4 block text-xs font-medium text-neutral-700">
          Type <code className="font-mono">{confirmWord}</code> to confirm
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 font-mono text-xs focus:border-neutral-400 focus:outline-none"
          />
        </label>
        {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
        <Button
          type="button"
          size="sm"
          className="mt-3 bg-red-600 hover:bg-red-700"
          disabled={confirm !== confirmWord || deleting}
          onClick={() => void deleteAccount()}
        >
          {deleting ? "Deleting…" : "Delete my account"}
        </Button>
      </section>
    </div>
  );
}
