import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getErrorMessage } from "@/lib/errors";
import type { CliSession } from "@/lib/types";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { KeyIcon, TerminalIcon } from "@/components/icons";

/**
 * Lets a user see which CLIs/MCP servers have logged in as them, and revoke
 * one. See supabase/migrations/0007_cli_sessions.sql for why "revoke" here
 * is cooperative (the CLI checks this table itself) rather than an
 * immediate, cryptographic kill of the underlying Supabase session.
 */
export function CliSessionsPage() {
  const [sessions, setSessions] = useState<CliSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("cli_sessions")
        .select("*")
        .order("created_at", { ascending: false })
        .returns<CliSession[]>();
      if (cancelled) return;
      if (error) {
        setError(getErrorMessage(error, "Couldn't load connected CLIs."));
        setSessions([]);
        return;
      }
      setSessions(data ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function revoke(id: string) {
    setRevokingId(id);
    try {
      const { error } = await supabase
        .from("cli_sessions")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      setSessions((current) =>
        current?.map((s) => (s.id === id ? { ...s, revoked_at: new Date().toISOString() } : s)) ?? null,
      );
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't revoke that session."));
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">CLI access</h1>
        <p className="mt-1 text-sm text-neutral-500">
          CLIs and MCP servers that have signed in as you via{" "}
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs">feedbackkit login</code>. Revoking
          one stops it the next time it checks in — see the note on this page's source for the
          exact guarantee.
        </p>
      </div>

      {error ? <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      {sessions === null ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl border border-neutral-200 bg-white" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <EmptyState
          icon={<KeyIcon className="h-6 w-6" />}
          title="No CLIs connected yet"
          description={
            <>
              Run <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs">feedbackkit login</code> to
              connect one.
            </>
          }
        />
      ) : (
        <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
          {sessions.map((session) => {
            const revoked = Boolean(session.revoked_at);
            return (
              <li key={session.id} className="flex items-center gap-3 px-4 py-3.5">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    revoked ? "bg-neutral-100 text-neutral-400" : "bg-emerald-50 text-emerald-600"
                  }`}
                >
                  <TerminalIcon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-neutral-900">{session.label}</p>
                  <p className="text-xs text-neutral-500">
                    Connected {new Date(session.created_at).toLocaleString()}
                    {session.revoked_at ? ` · Revoked ${new Date(session.revoked_at).toLocaleString()}` : ""}
                  </p>
                </div>
                {revoked ? (
                  <span className="shrink-0 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-500">
                    Revoked
                  </span>
                ) : (
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={revokingId === session.id}
                    onClick={() => revoke(session.id)}
                    className="shrink-0"
                  >
                    {revokingId === session.id ? "Revoking…" : "Revoke"}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
