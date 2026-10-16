import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { loginAction } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; blocked?: string; next?: string; registered?: string; reset?: string }>;
}) {
  const { error, blocked, next, registered, reset } = await searchParams;
  const user = await currentUser();
  const target = next && next.startsWith("/") ? next : "/dashboard";
  if (user) redirect(target);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold tracking-tight">eCheckPay</span>
        </div>
        <h1 className="mt-6 text-xl font-bold tracking-tight text-slate-900">Sign in</h1>
        <p className="mt-1 text-sm text-slate-600">
          Access your account with your email and password.
        </p>

        {error ? (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            Incorrect email or password.
          </div>
        ) : null}
        {blocked ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            This account is blocked. Contact support.
          </div>
        ) : null}
        {registered ? (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Account ready — sign in with your email and password.
          </div>
        ) : null}
        {reset ? (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Password updated — sign in with your new password.
          </div>
        ) : null}

        <form action={loginAction} className="mt-5 space-y-3">
          <input type="hidden" name="next" value={target} />
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Email
            </span>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm shadow-sm outline-none transition focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Password
            </span>
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm shadow-sm outline-none transition focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-full bg-[#0071e3] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0077ed]"
          >
            Sign in
          </button>
        </form>
        <div className="mt-4 flex items-center justify-between text-xs">
          <a href="/forgot" className="font-semibold text-[#0071e3] hover:underline">
            Forgot password?
          </a>
          <a href="/register" className="font-semibold text-[#0071e3] hover:underline">
            Create account
          </a>
        </div>
      </div>
    </div>
  );
}
