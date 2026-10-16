import { redirect } from "next/navigation";
import { setupPasswordAction } from "@/app/actions";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  mismatch: "The two passwords do not match.",
  not_saved: "Please confirm you saved your password before continuing.",
  weak: "Password is not strong enough.",
};

export default async function SetupPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string; detail?: string }>;
}) {
  const { token, error, detail } = await searchParams;
  if (!token) redirect("/verify?state=invalid");

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-sm card-surface p-8">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Create your password</h1>
        <p className="mt-1 text-sm text-slate-600">
          You&apos;ll use this password to sign in from now on.
        </p>

        {error ? (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {ERRORS[error] ?? "Something went wrong."}
            {error === "weak" && detail ? <div className="mt-1 text-xs">{detail}</div> : null}
          </div>
        ) : null}

        <div className="mt-4 rounded-lg border border-slate-200 bg-[#f7f7f8] px-3 py-2 text-xs leading-relaxed text-slate-600">
          <strong>Strong password required:</strong> at least 10 characters with letters, numbers
          and a symbol (for example <span className="font-mono">Sunset!Ride42</span>).
        </div>

        <form action={setupPasswordAction} className="mt-5 space-y-3">
          <input type="hidden" name="token" value={token} />
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              New password
            </span>
            <input
              type="password"
              name="password"
              required
              minLength={10}
              autoComplete="new-password"
              className="field-base"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Confirm password
            </span>
            <input
              type="password"
              name="confirm"
              required
              minLength={10}
              autoComplete="new-password"
              className="field-base"
            />
          </label>
          <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-[#f7f7f8] p-3 text-xs leading-relaxed text-slate-700">
            <input type="checkbox" name="saved" required className="mt-0.5" />
            <span>
              I have <strong>saved this password</strong> in a safe place. Recovery is only
              possible through my confirmed email address.
            </span>
          </label>
          <button
            type="submit"
            className="btn btn-primary w-full"
          >
            Create password & continue
          </button>
        </form>
      </div>
    </div>
  );
}
