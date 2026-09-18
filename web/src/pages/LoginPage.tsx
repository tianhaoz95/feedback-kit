import { useState, useTransition } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

export function LoginPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function signIn(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const { error } = await supabase.auth.signInWithPassword({
        email: String(formData.get("email")),
        password: String(formData.get("password")),
      });
      if (error) {
        setError(error.message);
        return;
      }
      navigate("/projects");
    });
  }

  function signUp(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const { error } = await supabase.auth.signUp({
        email: String(formData.get("email")),
        password: String(formData.get("password")),
        options: { data: { organization_name: String(formData.get("organizationName") || "My Team") } },
      });
      if (error) {
        setError(error.message);
        return;
      }
      navigate("/projects");
    });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link to="/" className="text-2xl font-semibold tracking-tight">
            FeedbackKit
          </Link>
          <p className="mt-1 text-sm text-neutral-500">
            The dashboard for feedback captured by your iOS app.
          </p>
        </div>

        {error ? (
          <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}

        <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-medium text-neutral-900">Sign in</h2>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              signIn(new FormData(event.currentTarget));
            }}
            className="mt-4 space-y-3"
          >
            <Field name="email" type="email" label="Email" />
            <Field name="password" type="password" label="Password" />
            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              {isPending ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-medium text-neutral-900">Create an account</h2>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              signUp(new FormData(event.currentTarget));
            }}
            className="mt-4 space-y-3"
          >
            <Field name="organizationName" type="text" label="Team / company name" />
            <Field name="email" type="email" label="Email" />
            <Field name="password" type="password" label="Password" />
            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50 disabled:opacity-50"
            >
              {isPending ? "Creating account..." : "Create account"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-neutral-400">
          By continuing you agree to the{" "}
          <Link to="/terms" className="underline hover:text-neutral-700">
            user agreement
          </Link>{" "}
          and{" "}
          <Link to="/privacy" className="underline hover:text-neutral-700">
            privacy notice
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

function Field({ name, type, label }: { name: string; type: string; label: string }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-neutral-600">{label}</span>
      <input
        name={name}
        type={type}
        required
        className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
      />
    </label>
  );
}
