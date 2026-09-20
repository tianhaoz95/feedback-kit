import { Link, Outlet, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

export function DashboardLayout() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/projects" className="text-sm font-semibold tracking-tight">
            FeedbackKit
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/cli-sessions" className="text-sm text-neutral-500 hover:text-neutral-900">
              CLI access
            </Link>
            <button
              type="button"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate("/login");
              }}
              className="text-sm text-neutral-500 hover:text-neutral-900"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
