import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import OnboardingWizard from "@/components/OnboardingWizard";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; name?: string; addr?: string; phone?: string; type?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.onboarded === 1) redirect("/dashboard");
  const sp = await searchParams;

  return (
    <div className="min-h-screen bg-[#f7f7f8] px-4 py-8 sm:py-14">
      <div className="mx-auto max-w-xl">
        <p className="text-center text-lg font-semibold tracking-tight text-[#16171c]">eCheckPay</p>
        <OnboardingWizard
          email={user.email}
          prefilled={{
            name: sp.name ?? user.displayName ?? "",
            addr: sp.addr ?? user.profileAddress ?? "",
            phone: sp.phone ?? user.profilePhone ?? "",
            type: sp.type ?? user.accountType ?? "business",
          }}
          errorText={sp.error === "bank" ? "Complete every bank field — routing must be 9 digits." : ""}
        />
      </div>
    </div>
  );
}
