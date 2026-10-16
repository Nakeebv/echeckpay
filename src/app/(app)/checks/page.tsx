import RegisterTable, { type RegisterRowView } from "@/components/RegisterTable";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { countChecks, listChecks } from "@/lib/data";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

export default async function ChecksPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { page: pageRaw } = await searchParams;
  const pageNumber = Math.max(1, Number(pageRaw) || 1);
  const [rows, total] = await Promise.all([
    listChecks(user.id, PAGE_SIZE, (pageNumber - 1) * PAGE_SIZE),
    countChecks(user.id),
  ]);

  const view: RegisterRowView[] = rows.map((r) => ({
    id: r.id,
    checkNumber: r.checkNumber,
    payeeName: r.payeeName,
    amountCents: r.amountCents,
    dateIssued: r.dateIssued,
    status: r.status,
    memo: r.memo,
    layout: r.layout,
    accountId: r.accountId,
    accountLabel: r.accountLabel,
    accountNumber: r.accountNumber,
    routingNumber: r.routingNumber,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">History</h1>
          <p className="mt-1 text-sm text-slate-600">
            Every check you have written. Open one to print it, or export the list for your bank.
          </p>
        </div>
      </div>
      <RegisterTable rows={view} total={total} page={pageNumber} pageSize={PAGE_SIZE} />
    </div>
  );
}
