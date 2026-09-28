import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getErrorMessage } from "@/lib/errors";
import {
  EXPIRY_OPTIONS,
  TOKEN_PRESETS,
  TOKEN_SCOPES,
  expiryDate,
  liveRunTokens,
  suggestedSecret,
  tokenState,
  type AccessToken,
  type TokenPreset,
  type TokenScope,
} from "@/lib/accessTokens";
import { Button } from "@/components/Button";
import { CopyButton } from "@/components/CopyButton";
import { KeyIcon, PlusIcon } from "@/components/icons";

/**
 * Project access tokens (0025_access_tokens_and_previews.sql): what CI and
 * agent runners use instead of a login. Each has scopes, an optional expiry,
 * and is shown exactly once (only a hash is stored). Report-limited run
 * tokens a workflow issues aren't listed, just counted under their parent.
 */
export function AccessTokensCard({ projectId }: { projectId: string }) {
  const [tokens, setTokens] = useState<AccessToken[]>([]);
  const [preset, setPreset] = useState<TokenPreset>("ci");
  const [custom, setCustom] = useState<TokenScope[]>(["feedback:read"]);
  const [name, setName] = useState(TOKEN_PRESETS.ci.name);
  const [expiry, setExpiry] = useState("never");
  const [created, setCreated] = useState<{ token: string; scopes: TokenScope[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("access_tokens")
      .select("id, project_id, name, token_prefix, scopes, expires_at, parent_id, feedback_id, created_at, last_used_at, revoked_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    setTokens((data ?? []) as AccessToken[]);
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const scopes = preset === "custom" ? custom : TOKEN_PRESETS[preset].scopes;
  const listed = useMemo(() => tokens.filter((t) => !t.parent_id), [tokens]);

  function pickPreset(next: TokenPreset) {
    setPreset(next);
    if (next !== "custom") setName(TOKEN_PRESETS[next].name);
  }

  async function create() {
    setBusy(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("create_access_token", {
      p_project_id: projectId,
      p_name: name,
      p_scopes: scopes,
      p_expires_at: expiryDate(expiry)?.toISOString() ?? null,
    });
    setBusy(false);
    if (rpcError) {
      setError(getErrorMessage(rpcError, "Couldn't create the token."));
      return;
    }
    setCreated({ token: data as string, scopes });
    void load();
  }

  async function revoke(id: string) {
    setError(null);
    const { error: updateError } = await supabase
      .from("access_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id);
    if (updateError) setError(getErrorMessage(updateError, "Couldn't revoke the token."));
    void load();
  }

  const secretCommand = created ? `gh secret set ${suggestedSecret(created.scopes)} --body '${created.token}'` : "";

  return (
    <section className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div>
        <div className="flex items-center gap-2">
          <KeyIcon className="h-5 w-5 text-neutral-900" />
          <h2 className="text-base font-semibold text-neutral-900">Access tokens</h2>
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          Let CI and agent runners use FeedbackKit without a login: store a token as a secret and the CLI picks it up
          (<code className="font-mono">FEEDBACKKIT_TOKEN</code>). Each token works for this project only, and only for
          what its scopes allow.
        </p>
      </div>

      {created ? (
        <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-medium text-amber-900">Copy it now — it won&apos;t be shown again.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-white px-2 py-1.5 font-mono text-[11px] text-neutral-900">{created.token}</code>
            <CopyButton text={created.token} />
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

      {listed.length > 0 ? (
        <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
          {listed.map((t) => {
            const state = tokenState(t);
            const runs = liveRunTokens(tokens, t.id);
            return (
              <li key={t.id} className={`space-y-1.5 px-3 py-2.5 text-xs ${state === "active" ? "" : "opacity-60"}`}>
                <div className="flex items-center gap-3">
                  <code className="font-mono text-neutral-500">{t.token_prefix}…</code>
                  <span className="flex-1 font-medium text-neutral-800">{t.name}</span>
                  <span className="text-neutral-400">
                    {state === "revoked"
                      ? "revoked"
                      : state === "expired"
                        ? "expired"
                        : t.last_used_at
                          ? `used ${new Date(t.last_used_at).toLocaleString()}`
                          : "never used"}
                  </span>
                  {state === "active" ? (
                    <button type="button" onClick={() => void revoke(t.id)} className="text-red-600 hover:text-red-700">
                      Revoke
                    </button>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {t.scopes.map((s) => (
                    <span key={s} className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] text-neutral-600">
                      {s}
                    </span>
                  ))}
                  {state === "active" ? (
                    t.expires_at ? (
                      <span className="text-[11px] text-neutral-500">expires {new Date(t.expires_at).toLocaleDateString()}</span>
                    ) : (
                      <span className="text-[11px] text-amber-700">never expires — revoke it when it&apos;s no longer needed</span>
                    )
                  ) : null}
                  {runs > 0 ? <span className="text-[11px] text-neutral-500">· {runs} live run token{runs === 1 ? "" : "s"}</span> : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      <form
        className="space-y-3 rounded-lg border border-neutral-200 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="What the token is for">
          {(["ci", "agent", "custom"] as const).map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={preset === p}
              onClick={() => pickPreset(p)}
              className={`rounded-lg border px-3 py-2 text-left text-xs ${
                preset === p ? "border-neutral-900 bg-neutral-50" : "border-neutral-200 hover:border-neutral-300"
              }`}
            >
              <span className="block font-medium text-neutral-900">{p === "custom" ? "Custom" : TOKEN_PRESETS[p].label}</span>
              <span className="mt-0.5 block text-[11px] leading-snug text-neutral-500">
                {p === "custom" ? "Pick the scopes yourself." : TOKEN_PRESETS[p].hint}
              </span>
            </button>
          ))}
        </div>

        {preset === "custom" ? (
          <fieldset className="grid gap-1.5 sm:grid-cols-2">
            <legend className="sr-only">Scopes</legend>
            {TOKEN_SCOPES.map((s) => (
              <label key={s.scope} className="flex items-start gap-2 text-xs">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={custom.includes(s.scope)}
                  onChange={(e) =>
                    setCustom((prev) => (e.target.checked ? [...prev, s.scope] : prev.filter((x) => x !== s.scope)))
                  }
                />
                <span>
                  <span className="font-medium text-neutral-800">{s.label}</span>{" "}
                  <code className="font-mono text-[10px] text-neutral-400">{s.scope}</code>
                  <span className="block text-[11px] text-neutral-500">{s.description}</span>
                </span>
              </label>
            ))}
          </fieldset>
        ) : (
          <p className="text-[11px] text-neutral-500">
            Scopes: {scopes.map((s) => TOKEN_SCOPES.find((x) => x.scope === s)?.label.toLowerCase()).join(", ")}.
          </p>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Token name"
            placeholder="github-actions"
            className="flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-xs focus:border-neutral-400 focus:outline-none"
          />
          <select
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
            aria-label="Expiry"
            className="rounded-lg border border-neutral-200 px-2 py-2 text-xs focus:border-neutral-400 focus:outline-none"
          >
            {EXPIRY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm" variant="secondary" disabled={busy || !name.trim() || scopes.length === 0}>
            <PlusIcon className="h-3.5 w-3.5" />
            Create token
          </Button>
        </div>
        {expiry === "never" ? (
          <p className="text-[11px] text-amber-700">
            No expiry keeps CI from breaking unexpectedly, but the token works until someone revokes it.
          </p>
        ) : null}
      </form>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </section>
  );
}
