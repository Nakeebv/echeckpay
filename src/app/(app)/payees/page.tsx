import PayeeManager, { type PayeeRow } from "@/components/PayeeManager";
import { listPayees } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function PayeesPage() {
  const payees = await listPayees();
  const rows: PayeeRow[] = payees.map((p) => ({
    id: p.id,
    name: p.name,
    address: p.address,
    phone: p.phone,
    email: p.email,
    isBusiness: p.isBusiness,
    defaultMemo: p.defaultMemo,
    notes: p.notes,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Payees</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Saved payees fill in automatically when you write a check — faster and typo-free.
        </p>
      </div>
      <PayeeManager payees={rows} />
    </div>
  );
}
