"use client";

import { useState } from "react";

type DashboardSyncProps = {
  sheetConfigured: boolean;
  sheetTabName: string;
  lastSheetSyncAt: string | null;
  syncedJobCount: number;
  autoSyncEnabled: boolean;
  autoSyncMessage?: string | null;
};

export default function DashboardSync({
  sheetConfigured,
  sheetTabName,
  lastSheetSyncAt: initialLastSync,
  syncedJobCount: initialJobCount,
  autoSyncEnabled,
  autoSyncMessage: initialMessage,
}: DashboardSyncProps) {
  const [lastSheetSyncAt, setLastSheetSyncAt] = useState(initialLastSync);
  const [syncedJobCount, setSyncedJobCount] = useState(initialJobCount);
  const [status, setStatus] = useState<string | null>(initialMessage ?? null);
  const [loading, setLoading] = useState(false);

  async function forceSync() {
    setLoading(true);
    setStatus("Syncing...");
    const response = await fetch("/api/jobs/sync", { method: "POST" });
    const data = await response.json();
    setLoading(false);

    if (response.ok) {
      if (data.lastSheetSyncAt) {
        setLastSheetSyncAt(data.lastSheetSyncAt);
      } else {
        setLastSheetSyncAt(new Date().toISOString());
      }
      setSyncedJobCount(Number(data.synced ?? syncedJobCount));
      setStatus(`Synced ${data.synced} jobs from ${sheetTabName}.`);
      return;
    }

    setStatus(data.error ?? "Sync failed.");
  }

  return (
    <section className="mt-6 rounded-xl border bg-white p-6">
      <h2 className="font-medium">Sheet sync</h2>
      <p className="mt-2 text-sm text-slate-600">
        Jobs are loaded from the <strong>{sheetTabName}</strong> tab automatically on first use
        and when that tab changes.
      </p>

      {!sheetConfigured ? (
        <p className="mt-3 text-sm text-amber-700">Google Sheet env vars are not configured on the server.</p>
      ) : (
        <>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Auto-sync</dt>
              <dd className="font-medium text-slate-800">{autoSyncEnabled ? "On" : "Off"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Cached jobs</dt>
              <dd className="font-medium text-slate-800">{syncedJobCount}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Last sync</dt>
              <dd className="font-medium text-slate-800">
                {lastSheetSyncAt
                  ? new Date(lastSheetSyncAt).toLocaleString()
                  : "Not synced yet for this account"}
              </dd>
            </div>
          </dl>

          <button
            type="button"
            onClick={forceSync}
            disabled={loading}
            className="mt-4 rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
          >
            {loading ? "Syncing..." : "Force sync now"}
          </button>
        </>
      )}

      {status ? <p className="mt-3 text-sm text-slate-700">{status}</p> : null}
    </section>
  );
}
