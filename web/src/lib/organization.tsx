import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import type { MembershipRole, OrganizationSummary } from "@/lib/types";

/**
 * The organizations the signed-in user belongs to, and the one they're
 * currently acting in. A person can be in several (their own plus any they
 * were invited to — see supabase/migrations/0016_teams.sql); the choice is
 * remembered per browser. Pages that list or create things (projects,
 * billing, team) scope to `current`; pages reached by id (a project, a
 * report) work in any organization the user belongs to, since RLS is what
 * decides access.
 */

const STORAGE_KEY = "feedbackkit.currentOrganizationId";

interface OrganizationContextValue {
  /** null while loading. */
  organizations: OrganizationSummary[] | null;
  current: OrganizationSummary | null;
  error: string | null;
  switchOrganization: (id: string) => void;
  refresh: () => Promise<OrganizationSummary[]>;
  createOrganization: (name: string) => Promise<string>;
}

const OrganizationContext = createContext<OrganizationContextValue | undefined>(undefined);

function readStoredId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Also used by the invite page, which runs outside the provider, to land in the joined organization. */
// eslint-disable-next-line react-refresh/only-export-components -- tiny helper shared with InvitePage
export function rememberCurrentOrganization(id: string) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Private mode etc. — the switch still applies for this page load.
  }
}

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<OrganizationSummary[] | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(() => readStoredId());
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return [];
    const { data, error } = await supabase
      .from("memberships")
      .select("role, created_at, organizations(id, name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .returns<{ role: MembershipRole; organizations: { id: string; name: string } | null }[]>();
    if (error) {
      setError(error.message);
      setOrganizations([]);
      return [];
    }
    const list = (data ?? [])
      .filter((row) => row.organizations)
      .map((row) => ({ id: row.organizations!.id, name: row.organizations!.name, role: row.role }));
    setError(null);
    setOrganizations(list);
    return list;
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const switchOrganization = useCallback((id: string) => {
    rememberCurrentOrganization(id);
    setCurrentId(id);
  }, []);

  const createOrganization = useCallback(
    async (name: string) => {
      const { data, error } = await supabase.rpc("create_organization", { p_name: name });
      if (error) throw error;
      const id = data as string;
      await refresh();
      switchOrganization(id);
      return id;
    },
    [refresh, switchOrganization],
  );

  const current = useMemo(() => {
    if (!organizations || organizations.length === 0) return null;
    return organizations.find((o) => o.id === currentId) ?? organizations[0];
  }, [organizations, currentId]);

  const value = useMemo(
    () => ({ organizations, current, error, switchOrganization, refresh, createOrganization }),
    [organizations, current, error, switchOrganization, refresh, createOrganization],
  );

  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- context + hook are one unit
export function useOrganization(): OrganizationContextValue {
  const ctx = useContext(OrganizationContext);
  if (!ctx) throw new Error("useOrganization must be used within an OrganizationProvider");
  return ctx;
}

/** Keeps a Team subscription's seat count in step after membership changes. Best effort: a no-op (501) until Stripe is set up. */
// eslint-disable-next-line react-refresh/only-export-components -- shared by TeamPage and InvitePage
export function syncBillingSeats(organizationId: string) {
  void supabase.functions.invoke("sync-billing-seats", { body: { organization_id: organizationId } }).catch(() => {});
}
