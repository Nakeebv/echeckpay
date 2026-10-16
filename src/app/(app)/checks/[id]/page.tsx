import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import CheckDetail from "@/components/CheckDetail";
import type { CheckAccountView, CheckView } from "@/components/CheckDocument";
import { getCheckDetail, serialExists, toAccountView } from "@/lib/data";
import type { LayoutId } from "@/lib/layouts";

export const dynamic = "force-dynamic";

export default async function CheckDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) notFound();
  const detail = await getCheckDetail(numericId, user.role === "admin" ? null : user.id);
  if (!detail) notFound();

  const { check, account, audit } = detail;
  const duplicate = await serialExists(account.id, check.checkNumber, check.id);

  const accountView: CheckAccountView = toAccountView(account);

  const checkView: CheckView & {
    id: number;
    layout: string;
    status: string;
    statusReason: string;
    payeeAddress: string;
    accountId: number;
    printCount: number;
  } = {
    background: check.background,
    id: check.id,
    checkNumber: check.checkNumber,
    payeeName: check.payeeName,
    payeeAddress: check.payeeAddress,
    amountCents: check.amountCents,
    dateIssued: check.dateIssued,
    memo: check.memo,
    layout: (check.layout as LayoutId) ?? "wallet",
    signatureMode: check.signatureMode,
    features: check.features ?? [],
    includeAmountField: check.includeAmountField,
    status: check.status,
    statusReason: check.statusReason,
    accountId: account.id,
    printCount: check.printCount,
  };

  return (
    <CheckDetail
      check={checkView}
      account={accountView}
      accountLabel={account.label}
      onUsFormat={account.onUsFormat}
      duplicateSerial={duplicate}
      audit={audit.map((a) => ({
        id: a.id,
        action: a.action,
        detail: a.detail,
        actor: a.actor,
        createdAt: a.createdAt.toISOString(),
      }))}
    />
  );
}
