import { signIn, signUp } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">FeedbackKit</h1>
          <p className="mt-1 text-sm text-neutral-500">
            The dashboard for feedback captured by your iOS app.
          </p>
        </div>

        {error ? (
          <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}

        <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-medium text-neutral-900">Sign in</h2>
          <form action={signIn} className="mt-4 space-y-3">
            <Field name="email" type="email" label="Email" />
            <Field name="password" type="password" label="Password" />
            <button
              type="submit"
              className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
            >
              Sign in
            </button>
          </form>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-medium text-neutral-900">Create an account</h2>
          <form action={signUp} className="mt-4 space-y-3">
            <Field name="organizationName" type="text" label="Team / company name" />
            <Field name="email" type="email" label="Email" />
            <Field name="password" type="password" label="Password" />
            <button
              type="submit"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
            >
              Create account
            </button>
          </form>
        </div>
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
