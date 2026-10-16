"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Thread = {
  id: number;
  subject: string;
  status: string;
  userEmail: string;
  updatedAt: string;
};

type Message = {
  id: number;
  authorRole: string;
  body: string;
  createdAt: string;
};

export default function AdminSupport({
  threads,
}: {
  threads: Thread[];
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Record<number, Message[]>>({});
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  async function openThread(id: number) {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setLoadingId(id);
    try {
      const res = await fetch(`/api/admin/support/${id}`);
      const data = (await res.json()) as { messages?: Message[] };
      setMessages((prev) => ({ ...prev, [id]: data.messages ?? [] }));
      setOpenId(id);
    } finally {
      setLoadingId(null);
    }
  }

  async function sendReply(id: number, setStatus: "answered" | "closed") {
    setBusy(true);
    try {
      await fetch("/api/admin/support", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ threadId: id, reply, status: setStatus }),
      });
      // reload conversation
      const res = await fetch(`/api/admin/support/${id}`);
      const data = (await res.json()) as { messages?: Message[] };
      setMessages((prev) => ({ ...prev, [id]: data.messages ?? [] }));
      setReply("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3">
      {threads.length === 0 ? (
        <p className="rounded-2xl border border-black/5 bg-white px-4 py-8 text-center text-sm text-slate-500 shadow-sm">
          No support threads yet.
        </p>
      ) : (
        threads.map((t) => (
          <div key={t.id} className="card-surface">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <button type="button" onClick={() => void openThread(t.id)} className="min-w-0 text-left">
                <div className="truncate text-sm font-semibold text-slate-800">{t.subject}</div>
                <div className="text-xs text-slate-500">
                  {t.userEmail} · updated {new Date(t.updatedAt).toLocaleString()}
                </div>
              </button>
              <div className="flex items-center gap-2">
                <span
                  className={`chip ring-1 ring-inset ${
                    t.status === "open"
                      ? "bg-amber-50 text-amber-800 ring-amber-200"
                      : t.status === "answered"
                        ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                        : "bg-slate-100 text-slate-600 ring-slate-200"
                  }`}
                >
                  {t.status}
                </span>
                <button type="button" onClick={() => void openThread(t.id)} className="btn btn-sm btn-ghost">
                  {openId === t.id ? "Hide" : "Open"}
                </button>
              </div>
            </div>

            {openId === t.id ? (
              <div className="border-t border-black/5 px-4 py-3">
                <div className="space-y-3">
                  {(messages[t.id] ?? []).map((m) => (
                    <div
                      key={m.id}
                      className={`rounded-xl px-3 py-2 text-sm ${
                        m.authorRole === "admin"
                          ? "ml-8 bg-[#2e51f0]/10 text-slate-800"
                          : "mr-8 bg-[#f7f7f8] text-slate-800"
                      }`}
                    >
                      <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        {m.authorRole === "admin" ? "Support" : "User"} ·{" "}
                        {new Date(m.createdAt).toLocaleString()}
                      </div>
                      {m.body}
                    </div>
                  ))}
                  {(messages[t.id] ?? []).length === 0 ? (
                    <p className="text-xs text-slate-400">Loading conversation…</p>
                  ) : null}
                </div>

                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Write instructions or a resolution…"
                  className="mt-3 field-base h-20"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={busy || reply.trim().length < 2}
                    onClick={() => void sendReply(t.id, "answered")}
                    className="btn btn-primary btn-sm"
                  >
                    Send reply
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void sendReply(t.id, "closed")}
                    className="btn btn-ghost btn-sm"
                  >
                    Reply &amp; close
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ))
      )}
    </section>
  );
}
