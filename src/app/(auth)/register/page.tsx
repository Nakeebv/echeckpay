import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { registerAction } from "@/app/actions";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  invalid_email: "Enter a valid email address.",
  email_taken: "An account with this email already exists — sign in instead.",
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  if (await currentUser()) redirect("/dashboard");

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-sm card-surface p-8">
        <div className="text-lg font-semibold tracking-tight">eCheckPay</div>
        <h1 className="mt-6 text-xl font-semibold tracking-tight text-slate-900">Create your account</h1>
        <p className="mt-1 text-sm text-slate-600">
          Step 1 of 2 — confirm your email. Your email is only used for password recovery.
        </p>

        {error && ERRORS[error] ? (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {ERRORS[error]}
          </div>
        ) : null}

        <form action={registerAction} className="mt-5 space-y-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Email address
            </span>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              className="field-base"
            />
          </label>
          <button
            type="submit"
            className="btn btn-primary w-full"
          >
            Continue
          </button>
        </form>
        <p className="mt-4 text-xs text-slate-500">
          Already registered?{" "}
          <a href="/login" className="font-semibold text-[#2e51f0] hover:underline">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
