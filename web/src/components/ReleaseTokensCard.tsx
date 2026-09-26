import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getErrorMessage } from "@/lib/errors";
import type { ReleaseToken } from "@/lib/types";
import { Button } from "@/components/Button";
import { CopyButton } from "@/components/CopyButton";
import { KeyIcon, PlusIcon } from "@/components/icons";

/**
 * Project release tokens (0015_push_to_main_releases.sql): what CI presents
 * to announce a build (`feedbackkit release --token`, the ci-release Edge
 * Function) — CI has no dashboard session. The token is shown exactly once;
 * only a hash is stored.
 */
export function ReleaseTokensCard({ projectId }: { projectId: string }) {
  const [tokens, setTokens] = useState<ReleaseToken[]>([]);
  const [name, setName] = useState("github-actions");
  const [created, setCreated] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("release_tokens")
      .select("id, project_id, name, token_prefix, created_at, last_used_at, revoked_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    setTokens((data ?? []) as ReleaseToken[]);
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    setBusy(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("create_release_token", { p_project_id: projectId, p_name: name });
    setBusy(false);
    if (rpcError) {
      setError(getErrorMessage(rpcError, "Couldn't create the token."));
      return;
    }
    setCreated(data as string);
    void load();
  }

  async function revoke(id: string) {
    setError(null);
    const { error: updateError } = await supabase
      .from("release_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id);
    if (updateError) setError(getErrorMessage(updateError, "Couldn't revoke the token."));
    void load();
  }

  const secretCommand = created ? `gh secret set FEEDBACKKIT_RELEASE_TOKEN --body '${created}'` : "";

  return (
    <section className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div>
        <div className="flex items-center gap-2">
          <KeyIcon className="h-5 w-5 text-neutral-900" />
          <h2 className="text-base font-semibold text-neutral-900">Release tokens</h2>
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          Let CI announce every beta build without a login: store a token as the{" "}
          <code className="font-mono">FEEDBACKKIT_RELEASE_TOKEN</code> secret and the release scripts run{" "}
          <code className="font-mono">feedbackkit release</code> with it. A token can only list waiting fixes, record
          releases and mark them promoted — for this project.
        </p>
      </div>

      {created ? (
        <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-medium text-amber-900">Copy it now — it won&apos;t be shown again.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-white px-2 py-1.5 font-mono text-[11px] text-neutral-900">{created}</code>
            <CopyButton text={created} />
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-neutral-900 px-2 py-1.5 font-mono text-[11px] text-neutral-100">{secretCommand}</code>
            <CopyButton text={secretCommand} />
          </div>
          <button type="button" className="text-[11px] text-amber-900 underline" onClick={() => setCreated(null)}>
            Done
          </button>
        </div>
      ) : null}

      {tokens.length > 0 ? (
        <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
          {tokens.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-3 py-2 text-xs">
              <code className="font-mono text-neutral-500">{t.token_prefix}…</code>
              <span className="flex-1 font-medium text-neutral-800">{t.name}</span>
              <span className="text-neutral-400">
                {t.revoked_at
                  ? "revoked"
                  : t.last_used_at
                    ? `used ${new Date(t.last_used_at).toLocaleString()}`
                    : "never used"}
              </span>
              {!t.revoked_at ? (
                <button type="button" onClick={() => void revoke(t.id)} className="text-red-600 hover:text-red-700">
                  Revoke
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Token name"
          placeholder="github-actions"
          className="flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-xs focus:border-neutral-400 focus:outline-none"
        />
        <Button type="submit" size="sm" variant="secondary" disabled={busy || !name.trim()}>
          <PlusIcon className="h-3.5 w-3.5" />
          Create token
        </Button>
      </form>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </section>
  );
}
