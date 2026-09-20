import { Link } from "react-router-dom";

export function SiteFooter() {
  return (
    <footer className="border-t border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-neutral-500">
        <span>&copy; {new Date().getFullYear()} FeedbackKit</span>
        <div className="flex gap-4">
          <Link to="/docs" className="hover:text-neutral-900">
            Docs
          </Link>
          <a
            href="https://github.com/tianhaoz95/feedback-kit"
            className="hover:text-neutral-900"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
          <Link to="/privacy" className="hover:text-neutral-900">
            Privacy notice
          </Link>
          <Link to="/terms" className="hover:text-neutral-900">
            User agreement
          </Link>
        </div>
      </div>
    </footer>
  );
}
