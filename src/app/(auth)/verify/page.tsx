import { verifyEmailAction, setupPasswordAction } from "@/app/actions";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  mismatch: "Passwords do not match.",
  not_saved: "Please confirm you saved your password before continuing.",
  weak: "Password is not strong enough.",
};

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; state?: string; error?: string; detail?: string }>;
}) {
  const { token, state, error, detail } = await searchParams;

  if (state === "invalid" || !token) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">Link expired or already used</h1>
          <p className="mt-2 text-sm text-slate-600">
            This confirmation link is no longer valid. Register again to receive a fresh one.
          </p>
          <a
            href="/register"
            className="mt-4 inline-block rounded-full bg-[#0071e3] px-5 py-2 text-sm font-semibold text-white"
          >
            Register again
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="text-lg font-bold tracking-tight">eCheckPay</div>

        {error ? (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {ERRORS[error] ?? "Something went wrong."}
            {error === "weak" && detail ? <div className="mt-1 text-xs">{detail}</div> : null}
          </div>
        ) : null}

        {/* Step 1: confirm the token (form POST — never on GET prefetch) */}
        <form action={verifyEmailAction} className="mt-6">
          <input type="hidden" name="token" value={token} />
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Confirm your email</h1>
          <p className="mt-1 text-sm text-slate-600">
            Confirmed email = password recovery if you ever forget it.
          </p>
          <button
            type="submit"
            className="mt-4 w-full rounded-full bg-[#0071e3] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0077ed]"
          >
            Confirm email
          </button>
        </form>

        {/* Step 2: password setup */}
        <form action={setupPasswordAction} className="mt-8 hidden space-y-3">
          <input type="hidden" name="token" value={token} />
        </form>
      </div>
    </div>
  );
}
