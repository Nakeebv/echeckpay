import { notFound } from "next/navigation";
import PrintView from "@/components/PrintView";
import type { CheckAccountView, CheckView } from "@/components/CheckDocument";
import { getCheckDetail, serialExists, toAccountView } from "@/lib/data";
import { getLayout, type LayoutId } from "@/lib/layouts";
import { evaluateCompliance } from "@/lib/security";

export const dynamic = "force-dynamic";

export default async function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) notFound();
  const detail = await getCheckDetail(numericId);
  if (!detail) notFound();
  const { check, account } = detail;
  const layoutId: LayoutId = ((check.layout as LayoutId) ?? "wallet") as LayoutId;
  const layout = getLayout(layoutId);

  const duplicate = await serialExists(account.id, check.checkNumber, check.id);
  const compliance = evaluateCompliance({
    routingNumber: account.routingNumber,
    accountNumber: account.accountNumber,
    checkNumber: String(check.checkNumber),
    amountCents: check.amountCents,
    dateIssued: check.dateIssued,
    payeeName: check.payeeName,
    layout: layoutId,
    features: check.features ?? [],
    signatureMode: check.signatureMode,
    onUsFormat: account.onUsFormat as never,
    includeAmountField: check.includeAmountField,
    duplicateSerial: duplicate,
  });

  const accountView: CheckAccountView = toAccountView(account);

  const checkView: CheckView = {
    background: check.background,
    checkNumber: check.checkNumber,
    payeeName: check.payeeName,
    payeeAddress: check.payeeAddress,
    amountCents: check.amountCents,
    dateIssued: check.dateIssued,
    memo: check.memo,
    signatureMode: check.signatureMode,
    features: check.features ?? [],
    includeAmountField: check.includeAmountField,
    status: check.status,
  };

  return (
    <PrintView
      account={accountView}
      check={checkView}
      layoutId={layoutId}
      layoutName={layout.name}
      checkId={check.id}
      status={check.status}
      blockers={compliance.blockers}
      blockingLabels={compliance.checks
        .filter((c) => c.status === "fail")
        .map((c) => `${c.label}: ${c.detail}`)}
    />
  );
}
