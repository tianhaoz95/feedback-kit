import { useEffect } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Logomark } from "@/components/Logomark";
import { SiteFooter } from "@/components/SiteFooter";

const NAV = [
  { to: "/docs", label: "Overview", end: true },
  { to: "/docs/ios-sdk", label: "SDK (iOS, macOS & watchOS)" },
  { to: "/docs/dashboard", label: "Web dashboard" },
  { to: "/docs/cli", label: "CLI" },
  { to: "/docs/mcp", label: "MCP & coding agents" },
];

export function DocsLayout() {
  const { hash, pathname } = useLocation();

  // BrowserRouter doesn't scroll to #anchors on its own (unlike a real
  // browser navigation) — do it ourselves whenever the route/hash changes.
  useEffect(() => {
    if (hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" });
    } else {
      window.scrollTo(0, 0);
    }
  }, [pathname, hash]);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-2">
            <Logomark size={24} />
            <span className="text-sm font-semibold tracking-tight text-neutral-900">FeedbackKit</span>
          </Link>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/tianhaoz95/feedback-kit"
              target="_blank"
              rel="noreferrer"
              className="link-underline text-sm font-medium text-neutral-600 hover:text-neutral-900"
            >
              GitHub
            </a>
            <Link
              to="/login"
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-all duration-150 hover:-translate-y-0.5 hover:bg-neutral-800 active:translate-y-0 active:scale-95"
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
        {/* Section pills on small screens, in place of the sidebar. */}
        <nav className="mb-8 flex gap-2 overflow-x-auto pb-1 lg:hidden">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${
                  isActive
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-200 text-neutral-600"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex gap-10">
          <nav className="hidden w-52 shrink-0 lg:block">
            <div className="sticky top-10 space-y-0.5">
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `block rounded-md px-3 py-1.5 text-sm transition-colors ${
                      isActive
                        ? "bg-neutral-100 font-medium text-neutral-900"
                        : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </nav>

          <main className="min-w-0 flex-1 pb-16">
            <Outlet />
          </main>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
