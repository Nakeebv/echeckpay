import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import SupportClient from "@/components/SupportClient";

export const dynamic = "force-dynamic";

export default async function SupportPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Support</h1>
      <p className="mb-6 mt-1 text-sm text-slate-600">
        Questions, complaints or access problems — messages go straight to the operators.
      </p>
      <SupportClient />
    </div>
  );
}
