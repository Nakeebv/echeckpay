import { redirect } from "next/navigation";
import Link from "next/link";
import { isAuthed, loginIsFallback } from "@/lib/auth";
import { loginAction } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const fallback = loginIsFallback();
  const target = next && next.startsWith("/") ? next : "/dashboard";

  // Users landing here with a live session never see the form again.
  if (!error && (await isAuthed())) {
    redirect(target);
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-2">
          <Link href="/" className="text-lg font-bold tracking-tight">
            eCheckPay
          </Link>
        </div>
        <h1 className="mt-6 text-xl font-bold tracking-tight text-slate-900">Sign in</h1>
        <p className="mt-1 text-sm text-slate-600">
          Bank data lives here — routing numbers, account numbers and signature images are behind a
          single-operator sign-in.
        </p>

        {error ? (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            Incorrect password.
          </div>
        ) : null}
        {fallback ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
            <strong>Development mode:</strong> <code>AUTH_PASSWORD</code> is not set, so the password
            is <code className="select-all font-mono">echeckpay-dev</code>. Set{" "}
            <code>AUTH_PASSWORD</code> and <code>AUTH_SECRET</code> in <code>.env</code> before real
            use.
          </div>
        ) : null}

        <form action={loginAction} className="mt-5 space-y-3">
          <input type="hidden" name="next" value={target} />
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Operator password
            </span>
            <input
              type="password"
              name="password"
              required
              autoFocus
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-md bg-[#0071e3] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0077ed]"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
