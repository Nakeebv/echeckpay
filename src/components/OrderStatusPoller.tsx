"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Polls the reconciliation endpoint (server-side provider lookup) while an
 * order is still live, then refreshes the page. The browser can never mark an
 * order paid — it only triggers server-side checks that show the result.
 */
export default function OrderStatusPoller({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;
    async function tick() {
      try {
        setChecking(true);
        const res = await fetch(`/api/wallet/deposits/${orderId}/refresh`, { method: "POST" });
        const data = (await res.json()) as { order?: { status: string; processedAt?: string | null } };
        if (data.order && ["finished", "failed", "expired", "refunded", "underpaid"].includes(data.order.status)) {
          router.refresh();
          return;
        }
      } catch {
        /* transient — keep polling */
      } finally {
        setChecking(false);
      }
      if (!cancelled) timer = setTimeout(tick, 10_000);
    }
    timer = setTimeout(tick, 6_000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [orderId, router]);

  return (
    <p className="mt-4 flex items-center gap-2 text-xs text-slate-500">
      <span className={`inline-block h-2 w-2 rounded-full ${checking ? "bg-amber-400" : "bg-slate-300"}`} />
      {checking ? "Checking with NOWPayments…" : "Watching for payment updates…"}
    </p>
  );
}
