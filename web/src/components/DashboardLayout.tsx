import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { FeedbackKit, screenNameForPath, setUpFeedbackKit } from "@/lib/feedbackkit";
import { useOrganization } from "@/lib/organization";
import { getErrorMessage } from "@/lib/errors";
import { Logomark } from "@/components/Logomark";
import { Button } from "@/components/Button";
import { NotificationBell } from "@/components/NotificationBell";
import { OrganizationSwitcher } from "@/components/OrganizationSwitcher";
import { BookIcon, CreditCardIcon, FolderIcon, KeyIcon, LogOutIcon, MessageIcon, UsersIcon } from "@/components/icons";

const NAV_LINK_CLASS = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium transition-colors sm:px-2.5 ${
    isActive ? "bg-neutral-100 text-neutral-900 sm:bg-transparent" : "text-neutral-500 hover:text-neutral-900"
  }`;

export function DashboardLayout() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const displayName = (user?.user_metadata?.full_name as string | undefined) || user?.email || "";
  const location = useLocation();
  const [feedbackEnabled] = useState(() => setUpFeedbackKit());
  const { organizations } = useOrganization();

  // Keep reports' screen name in step with the route (the web counterpart of
  // setting `FeedbackKit.currentScreen` in a native `viewDidAppear`).
  useEffect(() => {
    FeedbackKit.currentScreen = screenNameForPath(location.pathname);
  }, [location.pathname, location.search]);

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="sticky top-0 z-10 border-b border-neutral-200/80 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-1.5 sm:gap-3">
            <Link to="/projects" className="flex shrink-0 items-center gap-2">
              <Logomark size={24} />
              <span className="hidden text-sm font-semibold tracking-tight text-neutral-900 lg:inline">
                FeedbackKit
              </span>
            </Link>
            <span className="hidden text-neutral-300 sm:inline">/</span>
            <OrganizationSwitcher />
          </div>
          <div className="flex items-center gap-0.5 sm:gap-1">
            <NavLink to="/projects" className={NAV_LINK_CLASS} aria-label="Projects">
              <FolderIcon className="h-4 w-4" />
              <span className="hidden md:inline">Projects</span>
            </NavLink>
            <NavLink to="/team" className={NAV_LINK_CLASS} aria-label="Team">
              <UsersIcon className="h-4 w-4" />
              <span className="hidden md:inline">Team</span>
            </NavLink>
            <NavLink
              to="/docs"
              target="_blank"
              rel="noreferrer"
              className={NAV_LINK_CLASS}
              aria-label="Docs"
            >
              <BookIcon className="h-4 w-4" />
              <span className="hidden md:inline">Docs</span>
            </NavLink>
            <NavLink to="/cli-sessions" className={NAV_LINK_CLASS} aria-label="CLI access">
              <KeyIcon className="h-4 w-4" />
              <span className="hidden md:inline">CLI access</span>
            </NavLink>
            <NavLink to="/billing" className={NAV_LINK_CLASS} aria-label="Billing">
              <CreditCardIcon className="h-4 w-4" />
              <span className="hidden md:inline">Billing</span>
            </NavLink>

            {feedbackEnabled && (
              <button
                type="button"
                onClick={() => void FeedbackKit.presentAndSubmit()}
                className={NAV_LINK_CLASS({ isActive: false })}
                aria-label="Send feedback about the dashboard"
                title="Send feedback (⌘⇧F / Ctrl+Shift+F)"
              >
                <MessageIcon className="h-4 w-4" />
                <span className="hidden lg:inline">Feedback</span>
              </button>
            )}

            <NotificationBell />

            <div className="mx-1 hidden h-5 w-px bg-neutral-200 sm:mx-2 sm:block" />

            <div className="flex items-center gap-1.5 pl-1 sm:gap-2">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-6 w-6 shrink-0 rounded-full ring-1 ring-neutral-200" />
              ) : (
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-[10px] font-semibold text-neutral-600">
                  {displayName.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="hidden max-w-[10rem] truncate text-sm text-neutral-600 md:inline">
                {displayName}
              </span>
              <button
                type="button"
                title="Sign out"
                onClick={async () => {
                  await supabase.auth.signOut();
                  navigate("/login");
                }}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
              >
                <LogOutIcon className="h-4 w-4" />
                <span className="sr-only">Sign out</span>
              </button>
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        {organizations && organizations.length === 0 ? <NoOrganization /> : <Outlet />}
      </main>
    </div>
  );
}

/** Shown if the user left or deleted every organization they were in. */
function NoOrganization() {
  const { createOrganization } = useOrganization();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="mx-auto max-w-md rounded-xl border border-neutral-200 bg-white p-6 text-center shadow-sm">
      <h1 className="text-lg font-semibold text-neutral-900">You're not in an organization</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Create one to start a project, or open an invite link someone sent you.
      </p>
      <form
        className="mt-4 flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          setBusy(true);
          setError(null);
          try {
            await createOrganization(name.trim());
            navigate("/projects");
          } catch (err) {
            setError(getErrorMessage(err, "Couldn't create the organization."));
          } finally {
            setBusy(false);
          }
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Organization name"
          className="min-w-0 flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
        />
        <Button type="submit" disabled={busy || !name.trim()}>
          {busy ? "Creating…" : "Create"}
        </Button>
      </form>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
