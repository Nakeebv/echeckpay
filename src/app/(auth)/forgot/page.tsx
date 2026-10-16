import { forgotAction } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function ForgotPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; adminLink?: string }>;
}) {
  const { sent, adminLink } = await searchParams;

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Reset your password</h1>
        {sent ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-slate-600">
              If that email belongs to a confirmed account, a reset link is on its way. The link
              expires in 60 minutes.
            </p>
            {adminLink ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
                <strong>Email delivery isn&apos;t configured.</strong> Operator reset link:
                <div className="mt-2 break-all rounded border border-amber-300 bg-white px-2 py-1.5 font-mono">
                  <a href={adminLink} className="text-[#0071e3] hover:underline">
                    {adminLink}
                  </a>
                </div>
              </div>
            ) : null}
            <a href="/login" className="inline-block text-sm font-semibold text-[#0071e3] hover:underline">
              Back to sign in
            </a>
          </div>
        ) : (
          <>
            <p className="mt-1 text-sm text-slate-600">
              Enter the email you registered with — we&apos;ll send a one-time reset link.
            </p>
            <form action={forgotAction} className="mt-5 space-y-3">
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm shadow-sm outline-none transition focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20"
              />
              <button
                type="submit"
                className="w-full rounded-full bg-[#0071e3] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0077ed]"
              >
                Send reset link
              </button>
            </form>
            <p className="mt-4 text-xs text-slate-500">
              No account or lost email access? The platform admin can issue a manual reset —{" "}
              <a href="/support" className="font-semibold text-[#0071e3] hover:underline">
                open a support request
              </a>
              .
            </p>
          </>
        )}
      </div>
    </div>
  );
}
