import { redirect } from "next/navigation";
import CheckWriter, { type AccountDTO, type EditingCheck, type PayeeDTO } from "@/components/CheckWriter";
import { currentUser } from "@/lib/auth";
import { getCheckDetail, listAccounts, listChecks, listPayees } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function WritePage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { edit } = await searchParams;
  const [accounts, payees, checks] = await Promise.all([
    listAccounts(user.id),
    listPayees(user.id),
    listChecks(user.id, 500),
  ]);

  const existingSerials: Record<number, number[]> = {};
  for (const c of checks) {
    existingSerials[c.accountId] = existingSerials[c.accountId] ?? [];
    existingSerials[c.accountId].push(c.checkNumber);
  }

  const accountDtos: AccountDTO[] = accounts.map((a) => ({
    id: a.id,
    label: a.label,
    accountClass: a.accountClass,
    holderName: a.holderName,
    holderAddress: a.holderAddress,
    holderPhone: a.holderPhone,
    bankName: a.bankName,
    bankAddress: a.bankAddress,
    routingNumber: a.routingNumber,
    accountNumber: a.accountNumber,
    fraction: a.fraction,
    onUsFormat: a.onUsFormat,
    nextCheckNumber: a.nextCheckNumber,
    logoDataUrl: a.logoDataUrl,
    bankLogoWidthIn: a.bankLogoWidthIn,
    companyLogoDataUrl: a.companyLogoDataUrl,
    companyLogoWidthIn: a.companyLogoWidthIn,
    signatureDataUrl: a.signatureDataUrl,
    signatureText: a.signatureText,
    signatureTitle: a.signatureTitle,
    background: a.background,
    micrRenderer: a.micrRenderer,
    micrFontDataUrl: a.micrFontDataUrl,
    micrFontSizePt: a.micrFontSizePt,
  }));

  const payeeDtos: PayeeDTO[] = payees.map((p) => ({
    id: p.id,
    name: p.name,
    address: p.address,
    defaultMemo: p.defaultMemo,
    isBusiness: p.isBusiness,
  }));

  let editing: EditingCheck | null = null;
  const editId = Number(edit);
  if (Number.isFinite(editId) && editId > 0) {
    const full = await getCheckDetail(editId);
    if (full && full.check.status === "draft") {
      editing = {
        id: full.check.id,
        accountId: full.account.id,
        payeeId: full.check.payeeId,
        payeeName: full.check.payeeName,
        payeeAddress: full.payee?.address ?? "",
        amountCents: full.check.amountCents,
        dateIssued: full.check.dateIssued,
        memo: full.check.memo,
        layout: full.check.layout,
        checkNumber: full.check.checkNumber,
        features: full.check.features ?? [],
        signatureMode: full.check.signatureMode,
        includeAmountField: full.check.includeAmountField,
        background: full.check.background,
      };
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {editing ? `Edit check #${editing.checkNumber}` : "Write a check"}
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Fill in the details, pick a design, and print a check your bank accepts. Every check is
          verified before it can be printed.
        </p>
      </div>
      <CheckWriter
        accounts={accountDtos}
        payees={payeeDtos}
        existingSerials={existingSerials}
        editing={editing}
        balanceCents={user.balanceCents}
      />
    </div>
  );
}
