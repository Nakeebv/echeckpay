"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckBack, CheckFace, MicrGauge } from "@/components/CheckDocument";
import type { CheckAccountView, CheckView } from "@/components/CheckDocument";
import { CompliancePanel } from "@/components/CompliancePanel";
import { Card, Field, inputCls } from "@/components/ui";
import { formatCents, legalAmount, parseAmountToCents } from "@/lib/amount";
import { LAYOUT_LIST, getLayout, type LayoutId } from "@/lib/layouts";
import { BACKGROUNDS, getBackground } from "@/lib/backgrounds";
import { isRoutingValid, routingCheckDigit } from "@/lib/micr";
import {
  FEATURE_IDS,
  evaluateCompliance,
  normalizeFeatures,
} from "@/lib/security";

export type AccountDTO = {
  id: number;
  label: string;
  accountClass: string;
  holderName: string;
  holderAddress: string;
  holderPhone: string;
  bankName: string;
  bankAddress: string;
  routingNumber: string;
  accountNumber: string;
  fraction: string;
  onUsFormat: string;
  nextCheckNumber: number;
  logoDataUrl: string | null;
  bankLogoWidthIn: number;
  companyLogoDataUrl: string | null;
  companyLogoWidthIn: number;
  signatureDataUrl: string | null;
  signatureText: string;
  signatureTitle: string;
  background: string;
  micrRenderer: string;
  micrFontDataUrl: string | null;
  micrFontSizePt: number;
};

export type PayeeDTO = {
  id: number;
  name: string;
  address: string;
  defaultMemo: string;
  isBusiness: boolean;
};

export type EditingCheck = {
  id: number;
  accountId: number;
  payeeId: number | null;
  payeeName: string;
  payeeAddress: string;
  amountCents: number;
  dateIssued: string;
  memo: string;
  layout: string;
  checkNumber: number;
  features: string[];
  signatureMode: string;
  includeAmountField: boolean;
  background: string;
};

const PATTERN_LABEL: Record<string, string> = {
  guilloche: "engraved lattice",
  rosettes: "rosette engraving",
  dots: "halftone",
  grid: "rule grid",
  pinstripe: "pinstripe",
  weave: "security weave",
  waves: "engraved waves",
  rings: "engraved rings",
  flourish: "flourish bands",
  none: "flat tint",
};

const FONT_FAMILY = '"MICR E13B"';

/** Core protections are always on for every check — not operator-toggled. */
const OPTIONAL_FEATURE_IDS = ["fraction", "thermochromic", "void_90_days", "void_180_days"];
const PERMANENT_FEATURES = normalizeFeatures(
  FEATURE_IDS.filter((id) => !OPTIONAL_FEATURE_IDS.includes(id)),
);

type VoidNotice = "none" | "90" | "180";

function seedOptional(features: string[] | undefined): {
  voidNotice: VoidNotice;
  withFraction: boolean;
  withThermo: boolean;
} {
  const set = new Set(features ?? []);
  return {
    voidNotice: set.has("void_180_days") ? "180" : set.has("void_90_days") ? "90" : "none",
    withFraction: set.has("fraction"),
    withThermo: set.has("thermochromic"),
  };
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

export default function CheckWriter({
  accounts,
  payees,
  existingSerials,
  editing,
}: {
  accounts: AccountDTO[];
  payees: PayeeDTO[];
  existingSerials: Record<number, number[]>;
  editing?: EditingCheck | null;
}) {
  const router = useRouter();
  const initialAccount = editing
    ? (accounts.find((a) => a.id === editing.accountId) ?? accounts[0])
    : accounts[0];

  const [accountId, setAccountId] = useState<number>(initialAccount?.id ?? 0);
  const [payeeId, setPayeeId] = useState<number>(editing?.payeeId ?? payees[0]?.id ?? 0);
  const [payeeName, setPayeeName] = useState(editing?.payeeName ?? payees[0]?.name ?? "");
  const [amount, setAmount] = useState(
    editing ? (editing.amountCents / 100).toFixed(2) : "1500.00",
  );
  const [dateIssued, setDateIssued] = useState(
    editing?.dateIssued ?? new Date().toISOString().slice(0, 10),
  );
  const [memo, setMemo] = useState(editing?.memo ?? payees.find((p) => p.id === (editing?.payeeId ?? payees[0]?.id))?.defaultMemo ?? "");
  const [layout, setLayout] = useState<LayoutId>(
    ((editing?.layout ??
      (initialAccount?.accountClass === "personal" ? "wallet3" : "voucher")) as LayoutId),
  );
  const [signatureMode, setSignatureMode] = useState(editing?.signatureMode ?? "facsimile");
  const [includeAmountField, setIncludeAmountField] = useState(editing?.includeAmountField ?? false);
  const [checkNumber, setCheckNumber] = useState<number>(
    editing?.checkNumber ?? initialAccount?.nextCheckNumber ?? 1001,
  );
  const seed = seedOptional(editing?.features);
  const [voidNotice, setVoidNotice] = useState<VoidNotice>(seed.voidNotice);
  const [withFraction, setWithFraction] = useState(seed.withFraction);
  const [withThermo, setWithThermo] = useState(seed.withThermo);
  const [side, setSide] = useState<"front" | "back">("front");
  const [zoom, setZoom] = useState(0.95);
  const [autoFit, setAutoFit] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [bundledFontReady, setBundledFontReady] = useState<"checking" | "ready" | "missing">("checking");

  // local patched mirror of the account's MICR / branding profile so edits are
  // immediate without waiting on router.refresh()
  const patchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const check = async (): Promise<"ready" | "missing"> => {
      if (typeof document === "undefined" || !("fonts" in document)) return "missing";
      try {
        const faces = await document.fonts.load(`12pt ${FONT_FAMILY}`);
        return faces.length ? "ready" : "missing";
      } catch {
        return "missing";
      }
    };
    void check().then((state) => {
      if (!cancelled) setBundledFontReady(state);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const account = accounts.find((a) => a.id === accountId) ?? accounts[0];

  const [accountBackground, setAccountBackground] = useState(
    editing?.background ?? initialAccount?.background ?? "per-sky",
  );
  const background = editing?.background ?? accountBackground;
  const [fontPt, setFontPt] = useState(initialAccount?.micrFontSizePt ?? 12);
  const [bankLogoW, setBankLogoW] = useState(initialAccount?.bankLogoWidthIn ?? 1.5);
  const [companyLogoW, setCompanyLogoW] = useState(initialAccount?.companyLogoWidthIn ?? 1.2);

  // Sync defaults ONLY when the account selection changes — never on unrelated
  // refreshes, which used to clobber whatever the operator had typed. Setting
  // state during render (guarded) is the React-endorsed "adjust state when a
  // prop changes" pattern and avoids effect-timing clobbering entirely.
  const [lastSyncedAccountId, setLastSyncedAccountId] = useState<number | null>(
    editing ? null : (initialAccount?.id ?? null),
  );
  if (account && !editing && account.id !== lastSyncedAccountId) {
    setLastSyncedAccountId(account.id);
    setCheckNumber(account.nextCheckNumber);
    setLayout(account.accountClass === "personal" ? "wallet3" : "voucher");
    setAccountBackground(account.background || "per-sky");
    setFontPt(account.micrFontSizePt);
    setBankLogoW(account.bankLogoWidthIn);
    setCompanyLogoW(account.companyLogoWidthIn);
  }

  const selectedPayee = payees.find((p) => p.id === payeeId);
  const amountCents = parseAmountToCents(amount);
  const layoutSpec = getLayout(layout);
  const routingValid = isRoutingValid(account?.routingNumber ?? "");

  // Security features on this check: the permanent bank-grade set plus the few
  // optional extras the operator picks in Check details.
  const features = useMemo(
    () =>
      normalizeFeatures([
        ...PERMANENT_FEATURES,
        ...(withFraction ? ["fraction"] : []),
        ...(withThermo ? ["thermochromic"] : []),
        ...(voidNotice === "90" ? ["void_90_days"] : voidNotice === "180" ? ["void_180_days"] : []),
      ]),
    [withFraction, withThermo, voidNotice],
  );

  async function patchAccount(patch: Record<string, unknown>) {
    if (!account) return;
    await fetch("/api/accounts", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: account.id, ...patch }),
    });
    router.refresh();
  }

  function commitFontPt(next: number) {
    setFontPt(next);
    if (patchTimer.current) clearTimeout(patchTimer.current);
    patchTimer.current = setTimeout(() => {
      void patchAccount({ micrFontSizePt: next });
    }, 500);
  }

  const accountView: CheckAccountView = useMemo(
    () => ({
      holderName: account?.holderName ?? "",
      holderAddress: account?.holderAddress ?? "",
      holderPhone: account?.holderPhone ?? "",
      bankName: account?.bankName ?? "",
      bankAddress: account?.bankAddress ?? "",
      routingNumber: account?.routingNumber ?? "",
      accountNumber: account?.accountNumber ?? "",
      // strictly manual: only an operator-entered fraction is ever printed
      fraction: account?.fraction || "",
      onUsFormat: account?.onUsFormat ?? "account-symbol-serial",
      logoDataUrl: account?.logoDataUrl ?? null,
      bankLogoWidthIn: bankLogoW,
      companyLogoDataUrl: account?.companyLogoDataUrl ?? null,
      companyLogoWidthIn: companyLogoW,
      signatureDataUrl: account?.signatureDataUrl ?? null,
      signatureText: account?.signatureText ?? "",
      signatureTitle: account?.signatureTitle ?? "Authorized Signature",
      accountClass: account?.accountClass ?? "business",
      background,
      micrRenderer: account?.micrRenderer ?? "font",
      micrFontDataUrl: account?.micrFontDataUrl ?? null,
      micrFontSizePt: fontPt,
    }),
    [account, background, fontPt, bankLogoW, companyLogoW],
  );

  // payee linkage: the printed name must match the linked payee record
  const effectivePayeeId = selectedPayee && selectedPayee.name === payeeName ? payeeId : null;

  const checkView: CheckView = useMemo(
    () => ({
      checkNumber,
      payeeName: payeeName || "—",
      payeeAddress: selectedPayee && selectedPayee.name === payeeName ? (selectedPayee.address ?? "") : "",
      amountCents,
      dateIssued,
      memo,
      signatureMode,
      features,
      includeAmountField,
      status: "draft",
      background,
    }),
    [checkNumber, payeeName, amountCents, dateIssued, memo, signatureMode, features, includeAmountField, selectedPayee, background],
  );

  const compliance = useMemo(
    () =>
      evaluateCompliance({
        routingNumber: account?.routingNumber ?? "",
        accountNumber: account?.accountNumber ?? "",
        checkNumber: String(checkNumber),
        amountCents,
        dateIssued,
        payeeName,
        layout,
        features,
        signatureMode,
        onUsFormat: (account?.onUsFormat ?? "account-symbol-serial") as never,
        includeAmountField,
        duplicateSerial: (existingSerials[accountId] ?? []).includes(checkNumber),
      }),
    [account, checkNumber, amountCents, dateIssued, payeeName, layout, features, signatureMode, includeAmountField, accountId, existingSerials],
  );

  // Keep the preview page inside its column by default (kills horizontal
  // overflow); the operator can still zoom manually.
  const previewRef = useRef<HTMLDivElement | null>(null);
  const docW = account ? getLayout(layout).page.width : 8.5;
  useEffect(() => {
    const el = previewRef.current;
    if (!el || !autoFit) return;
    const update = () => {
      const target = (el.clientWidth - 32) / (docW * 96);
      setZoom(Math.min(1.2, Math.max(0.3, Number(target.toFixed(2)))));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [autoFit, docW]);

  async function upload(
    file: File | undefined,
    field: "logoDataUrl" | "signatureDataUrl" | "companyLogoDataUrl",
  ) {
    if (!file || !account) return;
    if (file.size > 400_000) {
      setError("Image is too large — use a PNG/JPG under 400 KB.");
      return;
    }
    const dataUrl = await readFile(file);
    await fetch("/api/accounts", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: account.id, [field]: dataUrl }),
    });
    if (field === "signatureDataUrl") setSignatureMode("image");
    setNotice(
      field === "logoDataUrl"
        ? "Bank logo updated."
        : field === "companyLogoDataUrl"
          ? "Company logo updated."
          : "Signature image updated.",
    );
    router.refresh();
  }

  const logoWidthTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function commitLogoWidth(field: "bankLogoWidthIn" | "companyLogoWidthIn", inches: number) {
    // optimistic local echo + debounced persist
    if (field === "bankLogoWidthIn") setBankLogoW(inches);
    else setCompanyLogoW(inches);
    if (logoWidthTimer.current) clearTimeout(logoWidthTimer.current);
    logoWidthTimer.current = setTimeout(() => {
      void patchAccount({ [field]: inches });
    }, 400);
  }

  async function save(next?: "print") {
    if (!account) return;
    setBusy(true);
    setError(null);
    try {
      const payload = {
        accountId: account.id,
        payeeId: effectivePayeeId,
        payeeName,
        payeeAddress: checkView.payeeAddress,
        amountCents,
        dateIssued,
        memo,
        layout,
        signatureMode,
        features,
        includeAmountField,
        checkNumber,
        background,
      };
      let id: number | undefined;
      if (editing) {
        const res = await fetch(`/api/checks/${editing.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await res.json()) as { errors?: string[] };
        if (!res.ok) {
          setError((data.errors ?? ["Could not update the draft."]).join(" "));
          return;
        }
        id = editing.id;
      } else {
        const res = await fetch("/api/checks", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await res.json()) as { check?: { id: number; status: string }; errors?: string[] };
        if (!res.ok) {
          setError((data.errors ?? ["Could not save the check."]).join(" "));
          return;
        }
        id = data.check?.id;
      }
      if (next === "print" && id) {
        await fetch(`/api/checks/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: "printed" }),
        });
      }
      router.push(id ? `/checks/${id}` : "/checks");
    } finally {
      setBusy(false);
    }
  }

  if (!account) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm text-slate-600">
          No bank accounts yet. Add a routing and account number first.
        </p>
        <Link
          href="/accounts"
          className="mt-4 inline-block rounded-full bg-[#0071e3] px-4 py-2 text-sm font-semibold text-white"
        >
          Add an account
        </Link>
      </Card>
    );
  }

  const docH = layoutSpec.page.height;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      {/* ------------------------------------------------ form column */}
      <div className="space-y-5">
        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </div>
        ) : null}
        {notice ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {notice}
          </div>
        ) : null}
        {editing ? (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            Editing check #{editing.checkNumber} — details stay editable until the check is printed
            or issued.
          </div>
        ) : null}

        <Card className="p-5">
          <h2 className="text-base font-bold text-slate-900">Check details</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Amount" hint={legalAmount(amountCents)}>
              <input
                className={`${inputCls} font-mono text-base`}
                value={amount}
                inputMode="decimal"
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>
            <Field label="Date">
              <input
                className={inputCls}
                type="date"
                value={dateIssued}
                onChange={(e) => setDateIssued(e.target.value)}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Pay to the order of">
                <input
                  className={inputCls}
                  value={payeeName}
                  onChange={(e) => setPayeeName(e.target.value)}
                />
              </Field>
            </div>
            <Field label="Saved payee">
              <select
                className={inputCls}
                value={payeeId}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  setPayeeId(id);
                  const p = payees.find((x) => x.id === id);
                  if (p) {
                    setPayeeName(p.name);
                    setMemo(p.defaultMemo);
                  }
                }}
              >
                <option value={0}>Custom — not on file</option>
                {payees.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Check number">
              <input
                className={`${inputCls} font-mono`}
                type="number"
                value={checkNumber}
                min={1}
                onChange={(e) => setCheckNumber(Math.max(1, Number(e.target.value) || 1))}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Memo">
                <input className={inputCls} value={memo} onChange={(e) => setMemo(e.target.value)} />
              </Field>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Optional extras
            </div>
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-slate-700">
                &ldquo;VOID AFTER&rdquo; notice beside the amount box
              </span>
              <div className="flex overflow-hidden rounded-full border border-slate-300 bg-white p-0.5">
                {(
                  [
                    ["none", "Off"],
                    ["90", "90 days"],
                    ["180", "180 days"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    type="button"
                    key={value}
                    onClick={() => setVoidNotice(value)}
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                      voidNotice === value
                        ? "bg-[#1d1d1f] text-white"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <label className="mt-2.5 flex items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={withFraction}
                onChange={(e) => setWithFraction(e.target.checked)}
              />
              Print the fractional transit number (only if your bank wants it)
            </label>
            <label className="mt-2.5 flex items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={withThermo}
                onChange={(e) => setWithThermo(e.target.checked)}
              />
              Print the heat-check icon (rub to verify)
            </label>
            {withFraction && !account.fraction ? (
              <p className="mt-2 text-[11px] text-amber-700">
                Add a fractional number on the account first — nothing prints without it.
              </p>
            ) : null}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-base font-bold text-slate-900">Bank account</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Account to draw from">
              <select
                className={inputCls}
                value={accountId}
                onChange={(e) => setAccountId(Number(e.target.value))}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Next check number for this account"
              hint={`This account starts at ${account.nextCheckNumber}.`}
            >
              <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm font-medium text-slate-600">
                {account.nextCheckNumber}
              </div>
            </Field>
          </div>

          {!routingValid ? (
            <p className="mt-3 text-xs text-rose-700">
              This account&rsquo;s routing number looks incorrect (the last digit should be{" "}
              <span className="font-mono font-bold">
                {routingCheckDigit(account.routingNumber.slice(0, 8))}
              </span>
              ). Fix it on the Accounts page before printing.
            </p>
          ) : null}
        </Card>

        <Card className="p-5">
          <h2 className="text-base font-bold text-slate-900">Design</h2>
          <div className="mt-3">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Paper format
            </span>
            <div className="grid gap-2 sm:grid-cols-2">
              {LAYOUT_LIST.map((l) => (
                <button
                  type="button"
                  key={l.id}
                  onClick={() => setLayout(l.id)}
                  className={`rounded-lg border p-3 text-left transition ${
                    layout === l.id
                      ? "border-[#0071e3] bg-blue-50/60 ring-2 ring-[#0071e3]/15"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="text-sm font-semibold text-slate-900">{l.name}</div>
                  <div className="mt-0.5 text-[11px] leading-snug text-slate-500">{l.description}</div>
                </button>
              ))}
            </div>
          </div>

          <details className="mt-4 rounded-lg border border-slate-200 bg-slate-50 open:p-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 open:pb-1">
              <span className="text-xs font-semibold text-slate-700">
                Background — <span className="text-slate-900">{getBackground(background).name}</span>
              </span>
              <span className="text-[11px] font-semibold text-[#0071e3]">
                {typeof window === "undefined" ? "Change" : "Click to choose"}
              </span>
            </summary>
            <div className="space-y-3 px-1 pb-1">
              {(["business", "personal"] as const).map((grp) => (
                <div key={grp}>
                  <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    {grp === "business" ? "Business" : "Personal"}
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                    {BACKGROUNDS.filter((b) => b.group === grp).map((b) => (
                      <button
                        type="button"
                        key={b.id}
                        title={b.hint}
                        onClick={() =>
                          editing
                            ? setNotice("Saved checks keep their original background.")
                            : setAccountBackground(b.id)
                        }
                        disabled={Boolean(editing)}
                        className={`flex items-center gap-2 rounded-lg border p-2 text-left transition ${
                          background === b.id
                            ? "border-[#0071e3] bg-blue-50/60 ring-2 ring-[#0071e3]/15"
                            : editing
                              ? "border-slate-200 bg-white opacity-60"
                              : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <span
                          aria-hidden
                          className="h-7 w-7 flex-none rounded border border-slate-300"
                          style={{ background: b.swatch }}
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-[11px] font-semibold text-slate-900">
                            {b.name}
                          </span>
                          <span className="block truncate text-[10px] text-slate-500">
                            {b.blank ? "No tint" : PATTERN_LABEL[b.pattern]}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <p className="px-1 text-[11px] leading-relaxed text-slate-500">
                {getBackground(background).hint} Every design keeps the bottom of the check clear so
                the machine-read numbers always print cleanly.
              </p>
            </div>
          </details>
        </Card>

        <Card className="p-5">
          <h2 className="text-base font-bold text-slate-900">Signature &amp; logos</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Field label="Signature method">
              <select
                className={inputCls}
                value={signatureMode}
                onChange={(e) => setSignatureMode(e.target.value)}
              >
                <option value="facsimile">Signature text (typed)</option>
                <option value="image">Signature image on file</option>
                <option value="none">Unsigned (sign by hand)</option>
              </select>
            </Field>
            <Field label="Signature text">
              <input
                className={inputCls}
                defaultValue={account.signatureText}
                onBlur={async (e) => {
                  await fetch("/api/accounts", {
                    method: "PATCH",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ id: account.id, signatureText: e.target.value }),
                  });
                  router.refresh();
                }}
              />
            </Field>
            <Field label="Signature caption">
              <input
                className={inputCls}
                defaultValue={account.signatureTitle}
                onBlur={async (e) => {
                  await fetch("/api/accounts", {
                    method: "PATCH",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ id: account.id, signatureTitle: e.target.value }),
                  });
                  router.refresh();
                }}
              />
            </Field>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {(
              [
                {
                  key: "logoDataUrl" as const,
                  widthKey: "bankLogoWidthIn" as const,
                  width: bankLogoW,
                  title: "Bank logo",
                  hint: "Prints centred above the bank name.",
                  on: Boolean(account.logoDataUrl),
                },
                {
                  key: "companyLogoDataUrl" as const,
                  widthKey: "companyLogoWidthIn" as const,
                  width: companyLogoW,
                  title: "Company logo",
                  hint: "Prints at the top-left of the check.",
                  on: Boolean(account.companyLogoDataUrl),
                },
                {
                  key: "signatureDataUrl" as const,
                  widthKey: null,
                  width: null,
                  title: "Signature image",
                  hint: "Used when the signature method is “Signature image”.",
                  on: Boolean(account.signatureDataUrl),
                },
              ] as const
            ).map((cfg) => (
              <div key={cfg.key} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    {cfg.title}
                  </span>
                  {cfg.on ? (
                    <button
                      type="button"
                      onClick={() => {
                        void patchAccount({ [cfg.key]: null });
                        setNotice("Image removed.");
                      }}
                      className="rounded border border-rose-200 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 hover:bg-rose-50"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="mt-2 w-full text-[10px]"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    await upload(file, cfg.key);
                  }}
                />
                {cfg.on ? (
                  <div className="mt-2">
                    {cfg.widthKey ? (
                      <>
                        <div className="flex items-center justify-between text-[10px] text-slate-500">
                          <span>Size on check</span>
                          <span className="font-mono font-semibold">{cfg.width?.toFixed(2)}&quot;</span>
                        </div>
                        <input
                          type="range"
                          min={0.4}
                          max={2.6}
                          step={0.05}
                          value={cfg.width ?? 1.2}
                          onChange={(e) => commitLogoWidth(cfg.widthKey, Number(e.target.value))}
                          className="w-full"
                        />
                      </>
                    ) : (
                      <p className="text-[10px] text-slate-500">Sized automatically on the signature line.</p>
                    )}
                  </div>
                ) : (
                  <p className="mt-1 text-[10px] leading-snug text-slate-500">{cfg.hint}</p>
                )}
              </div>
            ))}
          </div>

          <details className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <summary className="cursor-pointer list-none text-xs font-semibold text-slate-700">
              Pre-encode the Amount field
              <span className="ml-2 font-normal text-slate-500">
                (special case — leave off unless your bank asks for it)
              </span>
            </summary>
            <label className="mt-3 flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={includeAmountField}
                onChange={(e) => setIncludeAmountField(e.target.checked)}
              />
              <span className="text-xs leading-relaxed text-slate-700">
                Print the amount into the numbers at the bottom of the check. Most banks prefer to
                add these numbers themselves, so only use this if your bank requests it.
              </span>
            </label>
          </details>
        </Card>

        <Card className="p-5">
          <details>
            <summary className="cursor-pointer list-none text-base font-bold text-slate-900">
              Advanced — MICR type &amp; bank format
            </summary>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              The built-in check-numbering typeface meets bank sizing standards on its own — only
              change these settings if your bank asks you to.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Numbering style">
                <select
                  className={inputCls}
                  value={account.micrRenderer}
                  onChange={(e) => patchAccount({ micrRenderer: e.target.value })}
                >
                  <option value="font">
                    {account.micrFontDataUrl ? "My uploaded typeface" : "Built-in (recommended)"}
                  </option>
                  <option value="vector">Drawn outlines</option>
                </select>
              </Field>
              <Field label={`Type size — ${fontPt} pt`}>
                <input
                  type="range"
                  min={8}
                  max={16}
                  step={0.25}
                  value={fontPt}
                  onChange={(e) => commitFontPt(Number(e.target.value))}
                  className="w-full"
                />
              </Field>
              <Field label="Bank MICR format" hint="Exactly as your bank specifies.">
                <select
                  className={inputCls}
                  value={account.onUsFormat}
                  onChange={async (e) => {
                    const onUsFormat = e.target.value;
                    await fetch("/api/accounts", {
                      method: "PATCH",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ id: account.id, onUsFormat }),
                    });
                    router.refresh();
                  }}
                >
                  <option value="account-symbol-serial">Standard</option>
                  <option value="account-symbol">Account only</option>
                  <option value="symbol-account">Bracketed</option>
                </select>
              </Field>
            </div>
            <div
              className={`mt-3 rounded-lg border px-3 py-2 text-xs font-semibold ${
                bundleTone(bundledFontReady)
              }`}
            >
              {bundleText(bundledFontReady)}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <div>
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Use your own numbered typeface file (optional)
                </span>
                <input
                  type="file"
                  accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2"
                  className="text-xs"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 2_000_000) {
                      setError("Font file is larger than 2 MB.");
                      return;
                    }
                    const dataUrl = await readFile(file);
                    await patchAccount({ micrFontDataUrl: dataUrl, micrRenderer: "font", micrFontSizePt: 12 });
                    setFontPt(12);
                    setNotice("Custom typeface installed on this account.");
                  }}
                />
              </div>
              {account.micrFontDataUrl ? (
                <button
                  type="button"
                  onClick={() => patchAccount({ micrFontDataUrl: null })}
                  className="rounded-md border border-rose-200 px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-50"
                >
                  Remove custom typeface
                </button>
              ) : null}
            </div>
          </details>
        </Card>
      </div>

      {/* ------------------------------------------------ preview column */}
      <div className="space-y-4 xl:sticky xl:top-20 xl:self-start">
        <Card className="p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="flex rounded-md border border-slate-300 bg-slate-100 p-0.5">
              {(["front", "back"] as const).map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setSide(s)}
                  className={`rounded px-3 py-1 text-xs font-semibold capitalize transition ${
                    side === s ? "bg-white shadow-sm text-slate-900" : "text-slate-500"
                  }`}
                >
                  {s === "front" ? "Front" : "Back"}
                </button>
              ))}
            </div>
            <label className="ml-auto flex items-center gap-2 text-[11px] font-semibold text-slate-600">
              <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} />
              Show alignment guide
            </label>
            {!autoFit ? (
              <button
                type="button"
                onClick={() => setAutoFit(true)}
                className="rounded border border-slate-300 px-2 py-0.5 text-[10px] font-bold text-slate-600 hover:bg-slate-50"
              >
                Fit
              </button>
            ) : null}
            <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-600">
              Zoom
              <input
                type="range"
                min={0.3}
                max={1.6}
                step={0.05}
                value={zoom}
                onChange={(e) => {
                  setAutoFit(false);
                  setZoom(Number(e.target.value));
                }}
              />
            </label>
          </div>

          {/* preview canvas — auto-fits the column width so the whole check page
              is visible; manual zoom overrides it */}
          <div ref={previewRef} className="overflow-auto rounded-lg bg-black p-4">
            <div
              className="check-scale doc-shadow mx-auto"
              style={{
                zoom,
                width: `${docW * 96}px`,
                height: `${docH * 96}px`,
                background: "#fff",
              }}
            >
              <div
                className="print-root"
                style={{
                  position: "relative",
                  width: `${docW}in`,
                  height: `${docH}in`,
                  background: "#fff",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    left: `${layoutSpec.offsets[0][0]}in`,
                    top: `${layoutSpec.offsets[0][1]}in`,
                    width: `${layoutSpec.width}in`,
                    height: `${layoutSpec.height}in`,
                  }}
                >
                  {side === "front" ? (
                    <CheckFace account={accountView} check={checkView} layoutId={layout} />
                  ) : (
                    <CheckBack account={accountView} check={checkView} layoutId={layout} />
                  )}
                  {showGrid && side === "front" ? <MicrGauge layoutId={layout} /> : null}
                </div>
                {showGrid && side === "front" ? (
                  <div
                    style={{
                      position: "absolute",
                      left: `${layoutSpec.offsets[0][0] + layoutSpec.width + 0.08}in`,
                      top: `${layoutSpec.offsets[0][1]}in`,
                      width: "1.5in",
                      fontSize: "5pt",
                      lineHeight: 1.5,
                      color: "#0f766e",
                    }}
                  >
                    <div style={{ color: "#a21caf" }}>— 5/8&rdquo; clear band</div>
                    <div>— 1/4&rdquo; print band</div>
                    <div>— baseline 3/16&rdquo;</div>
                    <div>— leading edge 5/16&rdquo;</div>
                    <div>— 1/8&rdquo; position cells</div>
                    <div style={{ marginTop: 4 }}>Transit {compliance.micrText.slice(0, 11)}</div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {showGrid ? (
            <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-[11px] leading-relaxed text-blue-900">
              <span className="font-semibold">Alignment guide on.</span> The magenta rule is the
              machine-read zone, tinted boxes mark the routing, account and amount fields. Only the
              check numbers may print there.
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || compliance.blockers > 0}
              onClick={() => save("print")}
              className="rounded-full bg-[#0071e3] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0077ed] disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {busy ? "Saving…" : "Save & print"}
            </button>
            <button
              type="button"
              disabled={busy || compliance.blockers > 0}
              onClick={() => save()}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save draft
            </button>
            {compliance.blockers > 0 ? (
              <span className="self-center text-[11px] font-semibold text-rose-700">
                Fix {compliance.blockers} issue{compliance.blockers === 1 ? "" : "s"} before printing.
              </span>
            ) : null}
          </div>
        </Card>

        <CompliancePanel result={compliance} />

        <Card className="p-4">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Amount in words
              </div>
              <p className="mt-1 text-sm font-semibold text-slate-900">{legalAmount(amountCents)}</p>
            </div>
            <div className="text-right">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                In numbers
              </div>
              <p className="mt-1 font-mono text-sm font-bold tabular-nums text-slate-900">
                {formatCents(amountCents)}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function bundleTone(state: "checking" | "ready" | "missing"): string {
  if (state === "ready") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (state === "missing") return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function bundleText(state: "checking" | "ready" | "missing"): string {
  if (state === "ready") return "✓ Check-numbering type is ready to print.";
  if (state === "missing")
    return "Built-in type could not load in this browser — switch the numbering style to “Drawn outlines” (same result, no font needed).";
  return "Checking the built-in type…";
}
