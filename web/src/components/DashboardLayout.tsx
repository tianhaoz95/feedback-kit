import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Logomark } from "@/components/Logomark";
import { BookIcon, KeyIcon, LogOutIcon } from "@/components/icons";

const NAV_LINK_CLASS = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors ${
    isActive ? "text-neutral-900" : "text-neutral-500 hover:text-neutral-900"
  }`;

export function DashboardLayout() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const displayName = (user?.user_metadata?.full_name as string | undefined) || user?.email || "";

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="sticky top-0 z-10 border-b border-neutral-200/80 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/projects" className="flex items-center gap-2">
            <Logomark size={24} />
            <span className="text-sm font-semibold tracking-tight text-neutral-900">FeedbackKit</span>
          </Link>
          <div className="flex items-center gap-1">
            <NavLink to="/docs" className={NAV_LINK_CLASS}>
              <BookIcon className="h-4 w-4" />
              Docs
            </NavLink>
            <NavLink to="/cli-sessions" className={NAV_LINK_CLASS}>
              <KeyIcon className="h-4 w-4" />
              CLI access
            </NavLink>

            <div className="mx-2 h-5 w-px bg-neutral-200" />

            <div className="flex items-center gap-2 pl-1">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-6 w-6 rounded-full ring-1 ring-neutral-200" />
              ) : (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-200 text-[10px] font-semibold text-neutral-600">
                  {displayName.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="hidden max-w-[10rem] truncate text-sm text-neutral-600 sm:inline">
                {displayName}
              </span>
              <button
                type="button"
                title="Sign out"
                onClick={async () => {
                  await supabase.auth.signOut();
                  navigate("/login");
                }}
                className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
              >
                <LogOutIcon className="h-4 w-4" />
                <span className="sr-only">Sign out</span>
              </button>
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
