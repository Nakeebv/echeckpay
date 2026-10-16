"use client";

import { useEffect, useState } from "react";

type Thread = { id: number; subject: string; status: string; updatedAt: string };

export default function SupportClient() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [replyFor, setReplyFor] = useState<number | null>(null);
  const [reply, setReply] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/support");
      const data = (await res.json()) as { threads?: Thread[] };
      setThreads(data.threads ?? []);
    } catch {
      /* keep previous */
    }
  }

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, []);

  async function submitThread() {
    setBusy(true);
    const res = await fetch("/api/support", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subject, body }),
    });
    setBusy(false);
    if (res.ok) {
      setSubject("");
      setBody("");
      setNotice("Message sent — operators will reply here.");
      void load();
    } else {
      setNotice("Could not send — both a subject and message are required.");
    }
  }

  async function submitReply(threadId: number) {
    setBusy(true);
    await fetch("/api/support", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ threadId, body: reply }),
    });
    setBusy(false);
    setReplyFor(null);
    setReply("");
    setNotice("Reply sent.");
    void load();
  }

  return (
    <div className="space-y-6">
      <section className="card-surface p-5">
        <h2 className="text-base font-semibold text-slate-900">New message</h2>
        {notice ? <p className="mt-2 text-xs font-semibold text-emerald-700">{notice}</p> : null}
        <div className="mt-3 space-y-3">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="field-base"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Describe the issue or question…"
            className="h-24 field-base"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void submitThread()}
            className="btn btn-primary disabled:opacity-50"
          >
            Send to operators
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-900">Your conversations</h2>
        {threads.length === 0 ? (
          <p className="card-surface px-4 py-6 text-center text-sm text-slate-500">
            Nothing yet — open a request above.
          </p>
        ) : (
          threads.map((t) => (
            <div key={t.id} className="card-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-800">{t.subject}</div>
                  <div className="text-xs text-slate-400">
                    {t.status} · updated {new Date(t.updatedAt).toLocaleString()}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyFor(replyFor === t.id ? null : t.id)}
                  className="rounded border border-slate-300 px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-50"
                >
                  {replyFor === t.id ? "Close" : "Reply"}
                </button>
              </div>
              {replyFor === t.id ? (
                <div className="mt-3 space-y-2">
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    className="field-base h-20"
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void submitReply(t.id)}
                    className="btn btn-primary btn-sm disabled:opacity-50"
                  >
                    Send reply
                  </button>
                </div>
              ) : null}
            </div>
          ))
        )}
      </section>
    </div>
  );
}
