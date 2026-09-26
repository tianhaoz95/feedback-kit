import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { syncBillingSeats, useOrganization } from "@/lib/organization";
import { getErrorMessage } from "@/lib/errors";
import { formatUsd, teamMonthlyTotal } from "@/lib/pricing";
import type { MembershipRole, OrganizationInvitation, OrganizationMember } from "@/lib/types";
import { Button } from "@/components/Button";
import { CopyButton } from "@/components/CopyButton";
import { LinkIcon, TrashIcon, UsersIcon } from "@/components/icons";

function inviteUrl(token: string) {
  return `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/invite/${token}`;
}

function displayName(m: OrganizationMember) {
  return m.full_name || m.user_name || m.email || "Unknown user";
}

function expiresIn(iso: string) {
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
  if (days <= 0) return "expired";
  return days === 1 ? "expires tomorrow" : `expires in ${days} days`;
}

export function TeamPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { current, organizations, refresh, switchOrganization } = useOrganization();
  const [members, setMembers] = useState<OrganizationMember[] | null>(null);
  const [invites, setInvites] = useState<OrganizationInvitation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [orgName, setOrgName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<MembershipRole>("member");
  const [newInvite, setNewInvite] = useState<OrganizationInvitation | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const isOwner = current?.role === "owner";
  const orgId = current?.id;

  const load = useCallback(async () => {
    if (!orgId) return;
    const [membersRes, invitesRes] = await Promise.all([
      supabase.rpc("organization_members", { p_org_id: orgId }),
      supabase
        .from("organization_invitations")
        .select("*")
        .eq("organization_id", orgId)
        .is("accepted_at", null)
        .is("revoked_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .returns<OrganizationInvitation[]>(),
    ]);
    if (membersRes.error) {
      setError(membersRes.error.message);
      setMembers([]);
      return;
    }
    setMembers((membersRes.data as OrganizationMember[] | null) ?? []);
    setInvites(invitesRes.data ?? []);
  }, [orgId]);

  useEffect(() => {
    setMembers(null);
    setNewInvite(null);
    setError(null);
    setOrgName(current?.name ?? "");
    void load();
  }, [load, current?.name]);

  async function run(key: string, action: () => Promise<void>, fallback: string) {
    setBusy(key);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(getErrorMessage(err, fallback));
    } finally {
      setBusy(null);
    }
  }

  if (!current) return null;

  const owners = members?.filter((m) => m.role === "owner").length ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Team</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Everyone in <span className="font-medium text-neutral-700">{current.name}</span> sees the same projects and
          reports, and gets notified about them. Owners manage people and billing.
        </p>
      </div>

      {error ? <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      {isOwner ? (
        <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-medium text-neutral-900">Organization name</h2>
          <form
            className="mt-3 flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              const name = orgName.trim();
              if (!name || name === current.name) return;
              void run(
                "rename",
                async () => {
                  const { error } = await supabase.from("organizations").update({ name }).eq("id", current.id);
                  if (error) throw error;
                  await refresh();
                },
                "Couldn't rename the organization.",
              );
            }}
          >
            <input
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
            />
            <Button type="submit" variant="secondary" disabled={busy === "rename" || !orgName.trim() || orgName.trim() === current.name}>
              {busy === "rename" ? "Saving…" : "Rename"}
            </Button>
          </form>
        </section>
      ) : null}

      <section className="rounded-xl border border-neutral-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <UsersIcon className="h-4 w-4 text-neutral-400" />
            <h2 className="text-sm font-medium text-neutral-900">Members</h2>
            {members ? <span className="text-xs text-neutral-400">{members.length}</span> : null}
          </div>
          {members ? (
            <p className="text-xs text-neutral-500">
              Team plan: {members.length} {members.length === 1 ? "seat" : "seats"} · {formatUsd(teamMonthlyTotal(members.length))}/month
            </p>
          ) : null}
        </div>
        {members === null ? (
          <div className="space-y-2 p-5">
            <div className="h-10 animate-pulse rounded bg-neutral-100" />
            <div className="h-10 animate-pulse rounded bg-neutral-100" />
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {members.map((m) => {
              const isSelf = m.user_id === user?.id;
              const lastOwner = m.role === "owner" && owners <= 1;
              return (
                <li key={m.user_id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  {m.avatar_url ? (
                    <img src={m.avatar_url} alt="" className="h-8 w-8 rounded-full ring-1 ring-neutral-200" />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-200 text-xs font-semibold text-neutral-600">
                      {displayName(m).slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-900">
                      {displayName(m)} {isSelf ? <span className="font-normal text-neutral-400">(you)</span> : null}
                    </p>
                    <p className="truncate text-xs text-neutral-500">
                      {m.user_name ? `@${m.user_name}` : null}
                      {m.user_name && m.email ? " · " : null}
                      {m.email}
                    </p>
                  </div>
                  {isOwner ? (
                    <select
                      aria-label={`Role for ${displayName(m)}`}
                      value={m.role}
                      disabled={busy !== null || lastOwner}
                      title={lastOwner ? "An organization needs at least one owner" : undefined}
                      onChange={(e) => {
                        const role = e.target.value as MembershipRole;
                        void run(
                          `role-${m.user_id}`,
                          async () => {
                            const { error } = await supabase.rpc("update_member_role", {
                              p_org_id: current.id,
                              p_user_id: m.user_id,
                              p_role: role,
                            });
                            if (error) throw error;
                            await load();
                            if (isSelf) await refresh();
                          },
                          "Couldn't change the role.",
                        );
                      }}
                      className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-700 disabled:opacity-60"
                    >
                      <option value="owner">Owner</option>
                      <option value="member">Member</option>
                    </select>
                  ) : (
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs capitalize text-neutral-600">{m.role}</span>
                  )}
                  {isOwner && !isSelf ? (
                    <button
                      type="button"
                      title="Remove from organization"
                      disabled={busy !== null}
                      onClick={() => {
                        if (!window.confirm(`Remove ${displayName(m)} from ${current.name}?`)) return;
                        void run(
                          `remove-${m.user_id}`,
                          async () => {
                            const { error } = await supabase.rpc("remove_member", { p_org_id: current.id, p_user_id: m.user_id });
                            if (error) throw error;
                            syncBillingSeats(current.id);
                            await load();
                          },
                          "Couldn't remove that member.",
                        );
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    >
                      <TrashIcon className="h-4 w-4" />
                      <span className="sr-only">Remove</span>
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {isOwner ? (
        <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <LinkIcon className="h-4 w-4 text-neutral-400" />
            <h2 className="text-sm font-medium text-neutral-900">Invite people</h2>
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            Create a link and send it however you like. It works once and expires in 7 days. Add an email to make sure
            only that person can use it (they must sign in to GitHub with that email).
          </p>
          <form
            className="mt-4 flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              void run(
                "invite",
                async () => {
                  const { data, error } = await supabase
                    .rpc("create_invitation", {
                      p_org_id: current.id,
                      p_email: inviteEmail.trim() || null,
                      p_role: inviteRole,
                    })
                    .single<OrganizationInvitation>();
                  if (error) throw error;
                  setNewInvite(data);
                  setInviteEmail("");
                  await load();
                },
                "Couldn't create the invitation.",
              );
            }}
          >
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Email (optional)"
              className="min-w-0 flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
            />
            <select
              aria-label="Role for the invited person"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as MembershipRole)}
              className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700"
            >
              <option value="member">Member</option>
              <option value="owner">Owner</option>
            </select>
            <Button type="submit" disabled={busy === "invite"}>
              {busy === "invite" ? "Creating…" : "Create invite link"}
            </Button>
          </form>

          {newInvite ? (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-sm font-medium text-emerald-900">
                Invite link ready{newInvite.email ? ` for ${newInvite.email}` : ""}. Send it to them:
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded bg-white px-2 py-1.5 text-xs text-neutral-700 ring-1 ring-emerald-200">
                  {inviteUrl(newInvite.token)}
                </code>
                <CopyButton text={inviteUrl(newInvite.token)} />
              </div>
            </div>
          ) : null}

          {invites.length > 0 ? (
            <div className="mt-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Pending invitations</h3>
              <ul className="mt-2 divide-y divide-neutral-100 rounded-lg border border-neutral-200">
                {invites.map((inv) => (
                  <li key={inv.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-neutral-800">{inv.email ?? "Anyone with the link"}</p>
                      <p className="text-xs text-neutral-500">
                        <span className="capitalize">{inv.role}</span> · {expiresIn(inv.expires_at)}
                      </p>
                    </div>
                    <CopyButton text={inviteUrl(inv.token)} />
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy !== null}
                      onClick={() =>
                        void run(
                          `revoke-${inv.id}`,
                          async () => {
                            const { error } = await supabase.rpc("revoke_invitation", { p_invitation_id: inv.id });
                            if (error) throw error;
                            if (newInvite?.id === inv.id) setNewInvite(null);
                            await load();
                          },
                          "Couldn't revoke the invitation.",
                        )
                      }
                    >
                      Revoke
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-xl border border-red-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-medium text-red-700">Leave or delete</h2>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-lg text-sm text-neutral-600">
            Leave {current.name}. You'll lose access to its projects until someone invites you again.
            {isOwner && owners <= 1 ? " You're its only owner, so make someone else an owner first." : ""}
          </p>
          <Button
            variant="danger"
            size="sm"
            disabled={busy !== null || (isOwner && owners <= 1)}
            onClick={() => {
              if (!user || !window.confirm(`Leave ${current.name}?`)) return;
              void run(
                "leave",
                async () => {
                  const { error } = await supabase.rpc("remove_member", { p_org_id: current.id, p_user_id: user.id });
                  if (error) throw error;
                  syncBillingSeats(current.id);
                  const remaining = await refresh();
                  if (remaining[0]) switchOrganization(remaining[0].id);
                  navigate("/projects");
                },
                "Couldn't leave the organization.",
              );
            }}
          >
            Leave organization
          </Button>
        </div>

        {isOwner ? (
          <div className="mt-5 border-t border-neutral-100 pt-4">
            <p className="text-sm text-neutral-600">
              Delete {current.name} and everything in it: every project, report and screenshot. This can't be undone.
              {organizations && organizations.length <= 1 ? " You need another organization to switch to first." : ""}
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder={`Type "${current.name}" to confirm`}
                className="min-w-0 flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-red-300"
              />
              <Button
                variant="danger"
                disabled={busy !== null || deleteConfirm !== current.name || (organizations?.length ?? 0) <= 1}
                onClick={() =>
                  void run(
                    "delete",
                    async () => {
                      const { error } = await supabase.rpc("delete_organization", { p_org_id: current.id });
                      if (error) throw error;
                      setDeleteConfirm("");
                      const remaining = await refresh();
                      if (remaining[0]) switchOrganization(remaining[0].id);
                      navigate("/projects");
                    },
                    "Couldn't delete the organization.",
                  )
                }
              >
                Delete organization
              </Button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
