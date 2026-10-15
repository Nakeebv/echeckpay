"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Card, Field, inputCls } from "@/components/ui";

export type PayeeRow = {
  id: number;
  name: string;
  address: string;
  phone: string;
  email: string;
  isBusiness: boolean;
  defaultMemo: string;
  notes: string;
};

const BLANK: PayeeRow = {
  id: 0,
  name: "",
  address: "",
  phone: "",
  email: "",
  isBusiness: false,
  defaultMemo: "",
  notes: "",
};

function PayeeForm({
  form,
  setForm,
  busy,
  error,
  editing,
  onCancel,
  onSubmit,
}: {
  form: PayeeRow;
  setForm: React.Dispatch<React.SetStateAction<PayeeRow>>;
  busy: boolean;
  error: string | null;
  editing: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <div>
      {error ? (
        <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Payee name">
          <input
            className={inputCls}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Address">
            <textarea
              className={`${inputCls} h-[66px]`}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Default memo">
          <input
            className={inputCls}
            value={form.defaultMemo}
            onChange={(e) => setForm({ ...form, defaultMemo: e.target.value })}
          />
        </Field>
        <Field label="Phone">
          <input
            className={inputCls}
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </Field>
        <Field label="Email">
          <input
            className={inputCls}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </Field>
        <Field label="Notes" hint="Only you see this.">
          <input
            className={inputCls}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </Field>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={form.isBusiness}
            onChange={(e) => setForm({ ...form, isBusiness: e.target.checked })}
          />
          Business
        </label>
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onSubmit}
          className="rounded-full bg-[#0071e3] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0077ed] disabled:opacity-50"
        >
          {busy ? "Saving…" : editing ? "Save changes" : "Add payee"}
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

export default function PayeeManager({ payees }: { payees: PayeeRow[] }) {
  const router = useRouter();
  const [form, setForm] = useState<PayeeRow>(BLANK);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/payees", {
        method: editingId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(editingId ? { ...form, id: editingId } : form),
      });
      const data = (await res.json()) as { errors?: string[] };
      if (!res.ok) {
        setError((data.errors ?? ["Could not save."]).join(" "));
        return;
      }
      setForm(BLANK);
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
      const res = await fetch(`/api/payees?id=${id}&confirm=1`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json()) as { errors?: string[] };
        setError((data.errors ?? ["Could not delete."]).join(" "));
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
    setForm(BLANK);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-slate-600">
          People and businesses you write checks to. Click one to edit.
        </p>
        <button
          type="button"
          onClick={() => {
            if (adding) {
              closeForms();
            } else {
              setEditingId(null);
              setForm(BLANK);
              setAdding(true);
            }
          }}
          className="rounded-full bg-[#1d1d1f] px-4 py-2 text-sm font-semibold text-white hover:bg-black"
        >
          {adding ? "Close" : "+ Add payee"}
        </button>
      </div>

      {adding ? (
        <Card className="p-5">
          <h2 className="mb-3 text-base font-bold text-slate-900">New payee</h2>
          <PayeeForm
            form={form}
            setForm={setForm}
            busy={busy}
            error={error}
            editing={false}
            onCancel={closeForms}
            onSubmit={submit}
          />
        </Card>
      ) : null}

      <div className="space-y-3">
        {payees.map((p) => {
          const editing = editingId === p.id;
          return (
            <Card key={p.id} className="p-4">
              <div className="flex flex-wrap items-start gap-3">
                <div
                  className={`min-w-0 flex-1 ${editing ? "" : "cursor-pointer hover:opacity-80"}`}
                  onClick={() => {
                    if (editing) return;
                    setAdding(false);
                    setEditingId(p.id);
                    setForm(p);
                    setError(null);
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">{p.name}</span>
                    {p.isBusiness ? <Badge tone="indigo">business</Badge> : null}
                  </div>
                  <div className="mt-0.5 whitespace-pre-line text-xs text-slate-500">{p.address}</div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {[p.phone, p.email].filter(Boolean).join(" · ") || "—"}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (editing) {
                        closeForms();
                      } else {
                        setAdding(false);
                        setEditingId(p.id);
                        setForm(p);
                        setError(null);
                      }
                    }}
                    className="rounded-md border border-slate-300 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {editing ? "Collapse" : "Edit"}
                  </button>
                  {confirmDelete === p.id ? (
                    <span className="flex items-center gap-1 rounded-md border border-rose-300 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-800">
                      Delete this payee?
                      <button
                        type="button"
                        onClick={() => void remove(p.id)}
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
                      onClick={() => setConfirmDelete(p.id)}
                      className="rounded-md border border-rose-200 px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-50"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>

              {editing ? (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <h3 className="mb-3 text-sm font-bold text-slate-900">Edit “{p.name}”</h3>
                  <PayeeForm
                    form={form}
                    setForm={setForm}
                    busy={busy}
                    error={error}
                    editing
                    onCancel={closeForms}
                    onSubmit={submit}
                  />
                </div>
              ) : null}
            </Card>
          );
        })}
        {payees.length === 0 ? (
          <Card className="px-4 py-10 text-center text-sm text-slate-500">
            No payees yet — add one to write checks faster.
          </Card>
        ) : null}
      </div>
    </div>
  );
}
