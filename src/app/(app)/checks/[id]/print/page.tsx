import { notFound } from "next/navigation";
import PrintView from "@/components/PrintView";
import type { CheckAccountView, CheckView } from "@/components/CheckDocument";
import { getCheckDetail, serialExists, toAccountView } from "@/lib/data";
import { getLayout, type LayoutId } from "@/lib/layouts";
import { evaluateCompliance } from "@/lib/security";
import { currentUser } from "@/lib/auth";
import { consumePrintToken } from "@/lib/wallet";
import { sha256Hex } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * The print view. The CLEAN (watermark-free) sheet only renders for a valid
 * one-time print token issued by the paid print-charge endpoint. Without it
 * the sheet prints with a VOID overlay and no value as an instrument.
 */
export default async function PrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pt?: string }>;
}) {
  const { id } = await params;
  const { pt } = await searchParams;
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) notFound();

  const user = await currentUser();
  if (!user) notFound();

  const detail = await getCheckDetail(numericId, user.role === "admin" ? null : user.id);
  if (!detail) notFound();

  // one-time token: valid → mark consumed and render clean
  let clean = false;
  if (pt && pt.length >= 20 && pt.length <= 120) {
    clean = await consumePrintToken(sha256Hex(pt), user.id, numericId);
  }

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
      blockers={compliance.blockers + (clean ? 0 : 1)}
      blockingLabels={[
        ...compliance.checks
          .filter((c) => c.status === "fail")
          .map((c) => `${c.label}: ${c.detail}`),
        ...(clean
          ? []
          : ["Print pass missing or already used — the sheet renders as VOID and can't be used as an instrument. Run the paid print flow to get a clean copy."]),
      ]}
      clean={clean}
    />
  );
}
