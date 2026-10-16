import { redirect } from "next/navigation";
import { sendVerificationEmail } from "@/lib/tokens";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function RegisterSentPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; link?: string }>;
}) {
  const { email, link } = await searchParams;
  if (await currentUser()) redirect("/dashboard");

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-sm card-surface p-8">
        <div className="text-lg font-semibold tracking-tight">eCheckPay</div>
        <h1 className="mt-6 text-xl font-semibold tracking-tight text-slate-900">Check your email</h1>
        <p className="mt-1 text-sm text-slate-600">
          We sent a confirmation link to <strong>{email ?? "your email"}</strong>. Open it to set
          your password. The link expires in 48 hours.
        </p>
        {link ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
            <strong>Email delivery isn&apos;t configured yet.</strong> Use your confirmation link
            directly:
            <div className="mt-2 break-all rounded border border-amber-300 bg-white px-2 py-1.5 font-mono">
              <a href={link} className="text-[#2e51f0] hover:underline">
                {link}
              </a>
            </div>
          </div>
        ) : null}
        <p className="mt-4 text-xs text-slate-500">
          Didn&apos;t receive it?{" "}
          <a href="/register" className="font-semibold text-[#2e51f0] hover:underline">
            Register again
          </a>{" "}
          or contact support.
        </p>
      </div>
    </div>
  );
}
