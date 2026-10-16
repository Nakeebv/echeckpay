"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCents } from "@/lib/amount";

const MIN_CENTS = 5000;
const QUICK = [5000, 10000, 20000];

export default function WalletDeposit({ balanceCents }: { balanceCents: number }) {
  const router = useRouter();
  const [amountCents, setAmountCents] = useState(MIN_CENTS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);

  async function startDeposit() {
    setBusy(true);
    setError(null);
    setCode(null);
    try {
      const res = await fetch("/api/wallet/deposits", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amountCents }),
      });
      const data = (await res.json()) as { invoiceUrl?: string; errors?: string[]; code?: string };
      if (!res.ok || !data.invoiceUrl) {
        setError((data.errors ?? ["Could not start the deposit."]).join(" "));
        setCode(data.code ?? null);
        setBusy(false);
        return;
      }
      // leave for the hosted crypto checkout — the wallet page never marks paid
      window.location.assign(data.invoiceUrl);
    } catch {
      setError("Network error — try again.");
      setBusy(false);
    }
  }

  return (
    <section className="card-surface p-5">
      <h2 className="text-base font-semibold text-slate-900">Add funds</h2>
      <p className="mt-1 text-xs text-slate-500">
        Paid in crypto through NOWPayments. Minimum deposit {formatCents(MIN_CENTS)}.
      </p>

      {error ? (
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
          {code === "provider_unconfigured" ? (
            <div className="mt-1 text-xs text-rose-700">
              (Operator setup: add NOWPAYMENTS_API_KEY + NOWPAYMENTS_IPN_SECRET to the Worker secrets.)
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {QUICK.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setAmountCents(c)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              amountCents === c
                ? "bg-[#16171c] text-white"
                : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {formatCents(c)}
          </button>
        ))}
        <input
          type="number"
          min={MIN_CENTS / 100}
          step="1"
          value={amountCents / 100}
          onChange={(e) => setAmountCents(Math.max(0, Math.round(Number(e.target.value) * 100)))}
          className="w-32 rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm shadow-sm outline-none focus:border-[#2e51f0]"
        />
      </div>

      <button
        type="button"
        disabled={busy || amountCents < MIN_CENTS}
        onClick={() => void startDeposit()}
        className="mt-4 btn btn-primary disabled:cursor-not-allowed"
      >
        {busy ? "Opening checkout…" : `Deposit ${formatCents(Math.max(amountCents, MIN_CENTS))}`}
      </button>

      {balanceCents < 1000 ? (
        <p className="mt-3 text-xs text-amber-700">
          Your balance is below $10 — you can&apos;t save, preview or print checks until you add
          funds.
        </p>
      ) : null}
    </section>
  );
}
