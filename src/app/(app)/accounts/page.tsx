import AccountManager, { type AccountRow } from "@/components/AccountManager";
import { listAccounts } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const accounts = await listAccounts();
  const rows: AccountRow[] = accounts.map((a) => ({
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
    background: a.background,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Accounts</h1>
        <p className="mt-1 text-sm text-slate-600">
          Bank accounts you write checks from. Click an account to edit it.
        </p>
      </div>
      <AccountManager accounts={rows} />
    </div>
  );
}
