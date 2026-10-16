import { resetPasswordAction } from "@/app/actions";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  mismatch: "The two passwords do not match.",
  weak: "Password is not strong enough.",
};

export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; state?: string; error?: string; detail?: string }>;
}) {
  const { token, state, error, detail } = await searchParams;

  if (state === "invalid" || !token) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="w-full max-w-sm card-surface p-8 text-center">
          <h1 className="text-xl font-semibold text-slate-900">Link expired or already used</h1>
          <p className="mt-2 text-sm text-slate-600">Request a fresh reset link and try again.</p>
          <a
            href="/forgot"
            className="mt-4 inline-block btn btn-primary"
          >
            Request new link
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-sm card-surface p-8">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Choose a new password</h1>
        {error ? (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {ERRORS[error] ?? "Something went wrong."}
            {error === "weak" && detail ? <div className="mt-1 text-xs">{detail}</div> : null}
          </div>
        ) : null}
        <form action={resetPasswordAction} className="mt-5 space-y-3">
          <input type="hidden" name="token" value={token} />
          <input
            type="password"
            name="password"
            required
            minLength={10}
            autoComplete="new-password"
            className="field-base"
          />
          <input
            type="password"
            name="confirm"
            required
            minLength={10}
            autoComplete="new-password"
            className="field-base"
          />
          <p className="text-xs text-slate-500">
            At least 10 characters with letters, numbers and a symbol.
          </p>
          <button
            type="submit"
            className="btn btn-primary w-full"
          >
            Set new password
          </button>
        </form>
      </div>
    </div>
  );
}
