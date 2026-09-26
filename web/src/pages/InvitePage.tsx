import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { rememberCurrentOrganization, syncBillingSeats } from "@/lib/organization";
import { stashPendingInvite } from "@/lib/pendingInvite";
import { getErrorMessage } from "@/lib/errors";
import type { InvitationPreview } from "@/lib/types";
import { Logomark } from "@/components/Logomark";
import { Button } from "@/components/Button";
import { UsersIcon } from "@/components/icons";

/**
 * Where a team invitation link lands (supabase/migrations/0016_teams.sql).
 * Readable while signed out, so the person sees which organization they're
 * joining before signing in with GitHub; the token survives the OAuth round
 * trip via pendingInvite.ts.
 */
export function InvitePage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [invite, setInvite] = useState<InvitationPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc("get_invitation", { p_token: token });
      if (cancelled) return;
      if (error) {
        setError(error.message);
        setInvite({ status: "not_found" });
      } else {
        setInvite(data as InvitationPreview);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, loading, user?.id]);

  function openOrganization(orgId: string) {
    rememberCurrentOrganization(orgId);
    navigate("/projects");
  }

  async function accept() {
    setAccepting(true);
    setError(null);
    try {
      const { data, error } = await supabase.rpc("accept_invitation", { p_token: token });
      if (error) throw error;
      const orgId = data as string;
      syncBillingSeats(orgId);
      openOrganization(orgId);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't accept the invitation."));
      setAccepting(false);
    }
  }

  function signIn() {
    stashPendingInvite(token);
    navigate("/login");
  }

  const orgName = invite?.organization_name ?? "an organization";

  let body: ReactNode;
  if (loading || invite === null) {
    body = <p className="text-center text-sm text-neutral-400">Loading…</p>;
  } else if (invite.status === "not_found") {
    body = (
      <Message title="This invite link isn't valid">
        Check that you copied the whole link, or ask for a new one.
      </Message>
    );
  } else if (invite.already_member && invite.organization_id) {
    body = (
      <>
        <Message title={`You're already in ${orgName}`}>Nothing to accept — it's in your organization switcher.</Message>
        <Button className="w-full" onClick={() => openOrganization(invite.organization_id!)}>
          Open {orgName}
        </Button>
      </>
    );
  } else if (invite.status !== "pending") {
    const why = { expired: "has expired", revoked: "was revoked", accepted: "has already been used" }[invite.status];
    body = (
      <Message title={`This invitation ${why}`}>
        Ask someone in {orgName} for a new link.
      </Message>
    );
  } else {
    body = (
      <>
        <div className="flex flex-col items-center text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-900 text-lg font-semibold text-white">
            {orgName.slice(0, 1).toUpperCase()}
          </span>
          <h1 className="mt-3 text-lg font-semibold text-neutral-900">Join {orgName}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {invite.inviter_name ? `${invite.inviter_name} invited you` : "You've been invited"} as{" "}
            {invite.role === "owner" ? "an owner" : "a member"}. You'll see the team's projects and feedback, and get
            notified about new reports.
          </p>
          {invite.email ? (
            <p className="mt-2 text-xs text-neutral-400">This invitation is for {invite.email}.</p>
          ) : null}
        </div>
        {user ? (
          <Button className="w-full" disabled={accepting} onClick={() => void accept()}>
            <UsersIcon className="h-4 w-4" />
            {accepting ? "Joining…" : `Join ${orgName}`}
          </Button>
        ) : (
          <Button className="w-full" onClick={signIn}>
            Sign in with GitHub to join
          </Button>
        )}
      </>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <Link to="/" className="flex items-center justify-center gap-2">
          <Logomark size={28} />
          <span className="text-lg font-semibold tracking-tight text-neutral-900">FeedbackKit</span>
        </Link>
        <div className="space-y-5 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          {error ? <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
          {body}
        </div>
      </div>
    </div>
  );
}

function Message({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="text-center">
      <h1 className="text-base font-semibold text-neutral-900">{title}</h1>
      <p className="mt-1 text-sm text-neutral-500">{children}</p>
    </div>
  );
}
