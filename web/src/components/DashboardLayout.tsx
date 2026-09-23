import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Logomark } from "@/components/Logomark";
import { BookIcon, CreditCardIcon, KeyIcon, LogOutIcon } from "@/components/icons";

const NAV_LINK_CLASS = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium transition-colors sm:px-2.5 ${
    isActive ? "bg-neutral-100 text-neutral-900 sm:bg-transparent" : "text-neutral-500 hover:text-neutral-900"
  }`;

export function DashboardLayout() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const displayName = (user?.user_metadata?.full_name as string | undefined) || user?.email || "";

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="sticky top-0 z-10 border-b border-neutral-200/80 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-3 sm:px-6">
          <Link to="/projects" className="flex shrink-0 items-center gap-2">
            <Logomark size={24} />
            <span className="hidden text-sm font-semibold tracking-tight text-neutral-900 min-[380px]:inline">
              FeedbackKit
            </span>
          </Link>
          <div className="flex items-center gap-0.5 sm:gap-1">
            <NavLink
              to="/docs"
              target="_blank"
              rel="noreferrer"
              className={NAV_LINK_CLASS}
              aria-label="Docs"
            >
              <BookIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Docs</span>
            </NavLink>
            <NavLink to="/cli-sessions" className={NAV_LINK_CLASS} aria-label="CLI access">
              <KeyIcon className="h-4 w-4" />
              <span className="hidden sm:inline">CLI access</span>
            </NavLink>
            <NavLink to="/billing" className={NAV_LINK_CLASS} aria-label="Billing">
              <CreditCardIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Billing</span>
            </NavLink>

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
        <Outlet />
      </main>
    </div>
  );
}
