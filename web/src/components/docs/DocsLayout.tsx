import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Logomark } from "@/components/Logomark";
import { SiteFooter } from "@/components/SiteFooter";
import { slugify } from "@/lib/slugify";

interface RawNavItem {
  to: string;
  label: string;
  end?: boolean;
  sections: string[];
}

const RAW_NAV: RawNavItem[] = [
  {
    to: "/docs",
    label: "Overview",
    end: true,
    sections: [
      "The four pieces",
      "The shortest path to a working report",
      "How the pieces fit together",
      "What gets collected",
      "Getting help",
    ],
  },
  {
    to: "/docs/ios-sdk",
    label: "SDK (iOS, macOS & watchOS)",
    sections: [
      "Requirements",
      "Install",
      "Basic usage",
      "Triggers",
      "Tracking the current screen",
      "Annotation tools",
      "Making the screenshot optional",
      "Sending to the hosted dashboard",
      "watchOS: a stripped-down flow",
      "What's in a FeedbackReport",
      "Try it",
    ],
  },
  {
    to: "/docs/dashboard",
    label: "Web dashboard",
    sections: [
      "Sign in",
      "Create a project",
      "Review feedback",
      "Prompt templates",
      "Teams",
      "CLI access",
      "Self-hosting",
    ],
  },
  {
    to: "/docs/cli",
    label: "CLI",
    sections: [
      "Install",
      "Log in",
      "Commands",
      "Asking it how to use FeedbackKit itself",
      "Managing access",
    ],
  },
  {
    to: "/docs/mcp",
    label: "MCP & coding agents",
    sections: [
      "Prerequisites",
      "Claude Code",
      "Codex",
      "Antigravity",
      "Other agents",
      "Tools it exposes",
      "Example prompts",
    ],
  },
];

const NAV = RAW_NAV.map((item) => ({
  ...item,
  sections: item.sections.map((title) => ({
    title,
    id: slugify(title),
  })),
}));

function isTopicActive(item: (typeof NAV)[number], pathname: string) {
  if (item.end) {
    return pathname === item.to;
  }
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

export function DocsLayout() {
  const { hash, pathname } = useLocation();
  const [activeSection, setActiveSection] = useState<string>("");

  // BrowserRouter doesn't scroll to #anchors on its own (unlike a real
  // browser navigation) — do it ourselves whenever the route/hash changes.
  useEffect(() => {
    if (hash) {
      const id = hash.slice(1);
      setActiveSection(id);
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ block: "start" });
      } else {
        const timer = setTimeout(() => {
          document.getElementById(id)?.scrollIntoView({ block: "start" });
        }, 50);
        return () => clearTimeout(timer);
      }
    } else {
      window.scrollTo(0, 0);
      const currentNav = NAV.find((n) => isTopicActive(n, pathname));
      if (currentNav && currentNav.sections.length > 0) {
        setActiveSection(currentNav.sections[0].id);
      } else {
        setActiveSection("");
      }
    }
  }, [pathname, hash]);

  // Track the section in view as user scrolls
  useEffect(() => {
    const currentNav = NAV.find((n) => isTopicActive(n, pathname));
    if (!currentNav || currentNav.sections.length === 0) {
      return;
    }

    const sectionIds = currentNav.sections.map((s) => s.id);

    let rafId: number | null = null;
    const onScroll = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;

        // Check if user is scrolled to the bottom of the page
        const isAtBottom =
          window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 50;
        if (isAtBottom) {
          setActiveSection(sectionIds[sectionIds.length - 1]);
          return;
        }

        // 140px accounts for header + scroll margin
        let matchedId = sectionIds[0];
        for (const id of sectionIds) {
          const el = document.getElementById(id);
          if (el) {
            const rect = el.getBoundingClientRect();
            if (rect.top <= 140) {
              matchedId = id;
            } else {
              break;
            }
          }
        }

        if (matchedId) {
          setActiveSection(matchedId);
        }
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [pathname]);

  const handleSectionClick = (e: React.MouseEvent<HTMLAnchorElement>, sectionId: string) => {
    e.preventDefault();
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      window.history.pushState(null, "", `#${sectionId}`);
      setActiveSection(sectionId);
    }
  };

  const handleTopicClick = (item: (typeof NAV)[number], isActive: boolean) => {
    if (isActive) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      window.history.pushState(null, "", item.to);
      if (item.sections.length > 0) {
        setActiveSection(item.sections[0].id);
      }
    }
  };

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
        {/* Section pills on small screens, in place of the sidebar. The
            trailing fade hints that there's more to scroll to — without it,
            a pill cut off mid-word at the viewport edge reads as broken
            layout rather than "swipe for more". */}
        <div className="relative mb-8 lg:hidden">
          <nav className="flex gap-2 overflow-x-auto pb-1">
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
          <div className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-white to-transparent" />
        </div>

        <div className="flex gap-10">
          <nav className="hidden w-64 shrink-0 lg:block">
            <div className="sticky top-10 max-h-[calc(100vh-5rem)] space-y-1 overflow-y-auto pr-2">
              {NAV.map((item) => {
                const isActive = isTopicActive(item, pathname);
                return (
                  <div key={item.to} className="space-y-0.5">
                    <NavLink
                      to={item.to}
                      end={item.end}
                      onClick={() => handleTopicClick(item, isActive)}
                      className={() =>
                        `block rounded-md px-3 py-1.5 text-sm transition-colors ${
                          isActive
                            ? "bg-neutral-100 font-medium text-neutral-900"
                            : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                        }`
                      }
                    >
                      {item.label}
                    </NavLink>

                    {isActive && item.sections.length > 0 && (
                      <div className="my-1 ml-3 space-y-0.5 border-l border-neutral-200">
                        {item.sections.map((sec) => {
                          const isSecActive = activeSection === sec.id;
                          return (
                            <a
                              key={sec.id}
                              href={`#${sec.id}`}
                              onClick={(e) => handleSectionClick(e, sec.id)}
                              className={`-ml-px block border-l py-1 pl-3 text-xs leading-snug transition-colors ${
                                isSecActive
                                  ? "border-neutral-900 font-medium text-neutral-950"
                                  : "border-transparent text-neutral-500 hover:border-neutral-400 hover:text-neutral-900"
                              }`}
                            >
                              {sec.title}
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
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
