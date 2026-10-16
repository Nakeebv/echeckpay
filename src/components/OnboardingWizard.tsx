"use client";

import { useState } from "react";
import { saveOnboardingAction, skipOnboardingAction } from "@/app/actions";

type Props = {
  email: string;
  prefilled: { name: string; addr: string; phone: string; type: string };
  errorText: string;
};

const inputCls =
  "w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm shadow-sm outline-none transition focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20";

export default function OnboardingWizard({ email, prefilled, errorText }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState(prefilled.name);
  const [addr, setAddr] = useState(prefilled.addr);
  const [phone, setPhone] = useState(prefilled.phone);
  const [type, setType] = useState<"business" | "personal">(prefilled.type === "personal" ? "personal" : "business");
  const [bankLabel, setBankLabel] = useState("");
  const [bankName, setBankName] = useState("");
  const [routing, setRouting] = useState("");
  const [accountNo, setAccountNo] = useState("");
  const [busy, setBusy] = useState(false);

  const stepCls = (n: number) =>
    `flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
      step >= n ? "bg-[#1d1d1f] text-white" : "bg-slate-200 text-slate-500"
    }`;

  return (
    <div className="card-surface p-6 sm:p-8">
      <div className="mb-6 flex items-center justify-center gap-2">
        <div className={stepCls(1)}>1</div>
        <div className={`h-0.5 w-10 ${step >= 2 ? "bg-[#1d1d1f]" : "bg-slate-200"}`} />
        <div className={stepCls(2)} style={step < 2 ? { backgroundColor: "#e2e8f0", color: "#64748b" } : undefined}>2</div>
        <div className={`h-0.5 w-10 ${step >= 3 ? "bg-[#1d1d1f]" : "bg-slate-200"}`} />
        <div className={stepCls(3)}>3</div>
      </div>

      {errorText ? (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{errorText}</div>
      ) : null}

      {/* ONE form — all steps' inputs serialize into the server action */}
      <form action={saveOnboardingAction} onSubmit={() => setBusy(true)}>
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="profileName" value={name} />
        <input type="hidden" name="profileAddress" value={addr} />
        <input type="hidden" name="profilePhone" value={phone} />
        <input type="hidden" name="accountType" value={type} />

        {/* STEP 1 — personal details */}
        <div className={step === 1 ? "block" : "hidden"}>
          <h1 className="text-xl font-bold tracking-tight text-[#1d1d1f]">Welcome — add your details</h1>
          <p className="mt-1 text-sm text-slate-600">
            These print on every check you write, as the account holder.
          </p>
          <div className="mt-4 space-y-3">
            <input
              className={inputCls}
              placeholder="Full name / entity name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <textarea
              className={`${inputCls} h-20`}
              placeholder="Address (street, city, state, ZIP)"
              value={addr}
              onChange={(e) => setAddr(e.target.value)}
            />
            <input className={inputCls} placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <button
            type="button"
            disabled={!name.trim() || !addr.trim()}
            onClick={() => setStep(2)}
            className="btn btn-primary mt-5 w-full disabled:opacity-40"
          >
            Continue
          </button>
        </div>

        {/* STEP 2 — company or personal */}
        <div className={step === 2 ? "block" : "hidden"}>
          <h1 className="text-xl font-bold tracking-tight text-[#1d1d1f]">Who writes the checks?</h1>
          <p className="mt-1 text-sm text-slate-600">
            This decides the check size and the MICR layout your bank expects.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {(
              [
                { id: "business", title: "Company / Business", body: "8½\" business checks with voucher stubs — full-width MICR fields." },
                { id: "personal", title: "Personal", body: "6\" wallet checks — the compact personal format." },
              ] as const
            ).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => { setType(c.id); setStep(3); }}
                className={`rounded-xl border p-4 text-left transition ${
                  type === c.id
                    ? "border-[#0071e3] bg-blue-50/60 ring-2 ring-[#0071e3]/15"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="text-sm font-semibold text-[#1d1d1f]">{c.title}</div>
                <div className="mt-1 text-xs leading-snug text-slate-500">{c.body}</div>
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setStep(1)} className="mt-4 text-xs font-semibold text-slate-500 hover:underline">
            ← Back
          </button>
        </div>

        {/* STEP 3 — bank account */}
        <div className={step === 3 ? "block" : "hidden"}>
          <h1 className="text-xl font-bold tracking-tight text-[#1d1d1f]">Add your bank</h1>
          <p className="mt-1 text-sm text-slate-600">
            Copy the routing and account number from the bottom of an existing check.{" "}
            {type === "personal" ? "Personal checks will use the 6\" wallet format." : "Business checks will use the 8½\" voucher format."}
          </p>
          <div className="mt-4 space-y-3">
            <input
              className={inputCls}
              placeholder="Nickname (e.g. Operating)"
              name="bankLabel"
              value={bankLabel}
              onChange={(e) => setBankLabel(e.target.value)}
              required
            />
            <input
              className={inputCls}
              placeholder="Bank name"
              name="bankName"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              required
            />
            <input
              className={`${inputCls} font-mono`}
              placeholder="Routing number (9 digits)"
              name="routingNumber"
              value={routing}
              onChange={(e) => setRouting(e.target.value.replace(/[^0-9]/g, "").slice(0, 9))}
              maxLength={9}
              inputMode="numeric"
              required
            />
            <input
              className={`${inputCls} font-mono`}
              placeholder="Account number"
              name="accountNumber"
              value={accountNo}
              onChange={(e) => setAccountNo(e.target.value.replace(/[^0-9]/g, ""))}
              inputMode="numeric"
              required
            />
          </div>
          <button
            type="submit"
            disabled={busy || !bankLabel || !bankName || routing.length !== 9 || accountNo.length < 4}
            className="btn btn-primary mt-5 w-full disabled:opacity-40"
          >
            {busy ? "Setting up…" : "Finish setup"}
          </button>
          <button type="button" onClick={() => setStep(2)} className="mt-3 text-xs font-semibold text-slate-500 hover:underline">
            ← Back
          </button>
        </div>
      </form>

      <form action={skipOnboardingAction} className="mt-6 text-center">
        <input type="hidden" name="email" value={email} />
        <button type="submit" className="text-xs font-medium text-slate-400 hover:underline">
          Skip for now — set up later from Accounts
        </button>
      </form>
    </div>
  );
}
