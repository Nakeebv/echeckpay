"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge, Card, Field, inputCls } from "@/components/ui";
import { isRoutingValid, layoutMicr } from "@/lib/micr";
import { BACKGROUNDS } from "@/lib/backgrounds";

export type AccountRow = {
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
  background: string;
};

type FormState = {
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
  signatureText: string;
  signatureTitle: string;
  background: string;
};

const BLANK: FormState = {
  label: "",
  accountClass: "business",
  holderName: "",
  holderAddress: "",
  holderPhone: "",
  bankName: "",
  bankAddress: "",
  routingNumber: "",
  accountNumber: "",
  fraction: "",
  onUsFormat: "account-symbol-serial",
  nextCheckNumber: 1001,
  signatureText: "",
  signatureTitle: "Authorized Signature",
  background: "biz-guilloche-navy",
};

function AccountForm({
  form,
  setForm,
  busy,
  error,
  editingId,
  onCancel,
  onSubmit,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  busy: boolean;
  error: string | null;
  editingId: number | null;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const routing = form.routingNumber.replace(/[^0-9]/g, "");
  const valid = isRoutingValid(routing) || routing.length !== 9;
  const preview =
    routing.length === 9 && form.accountNumber.length >= 4
      ? layoutMicr({
          checkWidthIn: form.accountClass === "personal" ? 6 : 8.5,
          routingNumber: routing,
          accountNumber: form.accountNumber,
          checkNumber: String(form.nextCheckNumber),
          onUsFormat: form.onUsFormat as never,
          auxOnUs: form.accountClass !== "personal",
        })
      : null;

  return (
    <div>
      {error ? (
        <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Account name">
          <input
            className={inputCls}
            value={form.label}
            placeholder="Operating, Payroll…"
            onChange={(e) => setForm({ ...form, label: e.target.value })}
          />
        </Field>
        <Field label="Account type">
          <select
            className={inputCls}
            value={form.accountClass}
            onChange={(e) => setForm({ ...form, accountClass: e.target.value })}
          >
            <option value="business">Business</option>
            <option value="personal">Personal — 6&rdquo; wallet checks</option>
          </select>
        </Field>
        <Field label="Next check number">
          <input
            className={inputCls}
            type="number"
            value={form.nextCheckNumber}
            onChange={(e) => setForm({ ...form, nextCheckNumber: Number(e.target.value) || 1 })}
          />
        </Field>
        <Field label="Account holder">
          <input
            className={inputCls}
            value={form.holderName}
            onChange={(e) => setForm({ ...form, holderName: e.target.value })}
          />
        </Field>
        <Field label="Holder address">
          <textarea
            className={`${inputCls} h-[66px]`}
            value={form.holderAddress}
            onChange={(e) => setForm({ ...form, holderAddress: e.target.value })}
          />
        </Field>
        <Field label="Holder phone">
          <input
            className={inputCls}
            value={form.holderPhone}
            onChange={(e) => setForm({ ...form, holderPhone: e.target.value })}
          />
        </Field>
        <Field label="Bank name">
          <input
            className={inputCls}
            value={form.bankName}
            onChange={(e) => setForm({ ...form, bankName: e.target.value })}
          />
        </Field>
        <Field label="Bank address">
          <textarea
            className={`${inputCls} h-[66px]`}
            value={form.bankAddress}
            onChange={(e) => setForm({ ...form, bankAddress: e.target.value })}
          />
        </Field>
        <Field
          label="Routing number"
          hint={
            routing.length === 9
              ? valid
                ? "✓ Verified"
                : "This routing number looks incorrect"
              : "9 digits, from the bottom of your checks"
          }
        >
          <input
            className={`${inputCls} font-mono ${valid ? "" : "border-rose-400"}`}
            value={form.routingNumber}
            inputMode="numeric"
            onChange={(e) => setForm({ ...form, routingNumber: e.target.value })}
          />
        </Field>
        <Field label="Account number">
          <input
            className={`${inputCls} font-mono`}
            value={form.accountNumber}
            inputMode="numeric"
            onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
          />
        </Field>
        <Field label="Fractional number" hint="Optional — printed only if you enable it.">
          <input
            className={`${inputCls} font-mono`}
            value={form.fraction}
            placeholder="12-3456/7890"
            onChange={(e) => setForm({ ...form, fraction: e.target.value })}
          />
        </Field>
        <Field label="Default check design">
          <select
            className={inputCls}
            value={form.background}
            onChange={(e) => setForm({ ...form, background: e.target.value })}
          >
            {BACKGROUNDS.map((b) => (
              <option key={b.id} value={b.id}>
                {b.group === "business" ? "Business" : "Personal"} — {b.name}
              </option>
            ))}
          </select>
        </Field>
        {!editingId ? (
          <>
            <Field label="Signature text">
              <input
                className={inputCls}
                value={form.signatureText}
                onChange={(e) => setForm({ ...form, signatureText: e.target.value })}
              />
            </Field>
            <Field label="Signature caption">
              <input
                className={inputCls}
                value={form.signatureTitle}
                onChange={(e) => setForm({ ...form, signatureTitle: e.target.value })}
              />
            </Field>
          </>
        ) : null}
      </div>

      <details className="mt-4">
        <summary className="cursor-pointer list-none text-xs font-semibold text-slate-700">
          Advanced — bank MICR format
          <span className="ml-2 font-normal text-slate-500">(only if your bank specifies one)</span>
        </summary>
        <div className="mt-3 max-w-sm">
          <Field label="Bank MICR format" hint="Exactly as your bank instructs. The default works for most banks.">
            <select
              className={inputCls}
              value={form.onUsFormat}
              onChange={(e) => setForm({ ...form, onUsFormat: e.target.value })}
            >
              <option value="account-symbol-serial">Standard</option>
              <option value="account-symbol">Account only</option>
              <option value="symbol-account">Bracketed</option>
            </select>
          </Field>
        </div>
      </details>

      {preview ? (
        <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Check numbers preview
          </div>
          <div className="mt-1 break-all font-mono text-sm font-semibold tracking-widest text-teal-300">
            {preview.text}
          </div>
          {preview.errors.length ? (
            <div className="mt-1 text-[11px] text-rose-300">{preview.errors.join(" ")}</div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onSubmit}
          className="rounded-full bg-[#0071e3] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0077ed] disabled:opacity-50"
        >
          {busy ? "Saving…" : editingId ? "Save changes" : "Save account"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function AccountManager({ accounts }: { accounts: AccountRow[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>({ ...BLANK });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  function startEdit(a: AccountRow) {
    setAdding(false);
    setEditingId(a.id);
    setForm({
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
      signatureText: "",
      signatureTitle: "",
      background: a.background,
    });
    setError(null);
  }

  function startCreate() {
    setEditingId(null);
    setForm({ ...BLANK });
    setAdding((v) => !v);
    setError(null);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        ...form,
        fraction: form.fraction.trim(),
      };
      if (editingId) {
        payload.id = editingId;
        // untouched signature fields are not part of the edit form — drop them
        // so the PATCH does not overwrite existing values with blanks
        if (!form.signatureText) delete payload.signatureText;
        if (!form.signatureTitle) delete payload.signatureTitle;
      }
      const res = await fetch("/api/accounts", {
        method: editingId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { errors?: string[] };
      if (!res.ok) {
        setError((data.errors ?? ["Could not save."]).join(" "));
        return;
      }
      setForm({ ...BLANK });
      setEditingId(null);
      setAdding(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/accounts?id=${id}&confirm=1`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json()) as { errors?: string[] };
        setError((data.errors ?? ["Could not delete the account."]).join(" "));
        setConfirmDelete(null);
        return;
      }
      setConfirmDelete(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function closeForms() {
    setEditingId(null);
    setAdding(false);
    setForm({ ...BLANK });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-slate-600">
          Checks draw from these accounts. Details stay private to you.
        </p>
        <button
          type="button"
          onClick={startCreate}
          className="rounded-full bg-[#1d1d1f] px-4 py-2 text-sm font-semibold text-white hover:bg-black"
        >
          {adding ? "Close" : "+ Add account"}
        </button>
      </div>

      {adding ? (
        <Card className="p-5">
          <h2 className="mb-3 text-base font-bold text-slate-900">New account</h2>
          <AccountForm
            form={form}
            setForm={setForm}
            busy={busy}
            error={error}
            editingId={null}
            onCancel={closeForms}
            onSubmit={submit}
          />
        </Card>
      ) : null}

      <div className="space-y-3">
        {accounts.map((a) => {
          const ok = isRoutingValid(a.routingNumber);
          const editing = editingId === a.id;
          return (
            <Card key={a.id} className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div
                  className={`min-w-0 flex-1 cursor-pointer ${editing ? "" : "hover:opacity-80"}`}
                  onClick={() => (editing ? null : startEdit(a))}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">{a.label}</span>
                    <Badge tone={a.accountClass === "personal" ? "slate" : "indigo"}>
                      {a.accountClass}
                    </Badge>
                    <Badge tone={ok ? "green" : "rose"}>{ok ? "Verified" : "Routing error"}</Badge>
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {a.holderName ? `${a.holderName} · ` : ""}
                    {a.bankName} ·····{a.accountNumber.slice(-4)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href="/write"
                    className="rounded-md border border-slate-300 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Write a check
                  </Link>
                  <a
                    href={`/api/positive-pay?accountId=${a.id}`}
                    className="rounded-md border border-slate-300 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    ⤓ Bank file
                  </a>
                  <button
                    type="button"
                    onClick={() => (editing ? closeForms() : startEdit(a))}
                    className="rounded-md border border-slate-300 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {editing ? "Collapse" : "Edit"}
                  </button>
                  {confirmDelete === a.id ? (
                    <span className="flex items-center gap-1 rounded-md border border-rose-300 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-800">
                      Delete this account?
                      <button
                        type="button"
                        onClick={() => void remove(a.id)}
                        disabled={busy}
                        className="rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white hover:bg-rose-700 disabled:opacity-50"
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(null)}
                        className="rounded border border-rose-300 px-1.5 py-0.5 text-[10px] font-bold text-rose-700"
                      >
                        No
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(a.id)}
                      className="rounded-md border border-rose-200 px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-50"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>

              {editing ? (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <h3 className="mb-3 text-sm font-bold text-slate-900">Edit “{a.label}”</h3>
                  <AccountForm
                    form={form}
                    setForm={setForm}
                    busy={busy}
                    error={error}
                    editingId={a.id}
                    onCancel={closeForms}
                    onSubmit={submit}
                  />
                </div>
              ) : null}
            </Card>
          );
        })}
        {accounts.length === 0 ? (
          <Card className="px-4 py-10 text-center text-sm text-slate-500">
            No accounts yet — add your first bank account to start writing checks.
          </Card>
        ) : null}
      </div>
    </div>
  );
}
