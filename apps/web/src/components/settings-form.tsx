"use client";

import { useEffect, useState } from "react";

export default function SettingsForm() {
  const [openaiConfigured, setOpenaiConfigured] = useState(false);
  const [sheetConfigured, setSheetConfigured] = useState(false);
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);
  const [sheetTabNames, setSheetTabNames] = useState<string[]>([]);
  const [lastSheetSyncAt, setLastSheetSyncAt] = useState<string | null>(null);
  const [syncedJobCount, setSyncedJobCount] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        setOpenaiConfigured(Boolean(data.openaiConfigured));
        setSheetConfigured(Boolean(data.sheetConfigured));
        setSpreadsheetId(data.spreadsheetId ?? null);
        setSheetTabNames(Array.isArray(data.sheetTabNames) ? data.sheetTabNames : []);
        setLastSheetSyncAt(data.lastSheetSyncAt ?? null);
        setSyncedJobCount(Number(data.syncedJobCount ?? 0));
      })
      .catch(() => undefined);
  }, []);

  async function syncSheet() {
    setLoading(true);
    setStatus("Syncing sheet tabs...");
    const response = await fetch("/api/jobs/sync", { method: "POST" });
    const data = await response.json();
    setLoading(false);

    if (response.ok) {
      setLastSheetSyncAt(new Date().toISOString());
      setSyncedJobCount(Number(data.synced ?? syncedJobCount));
      setStatus(
        `Synced ${data.synced} rows${data.tabs ? ` (${Object.entries(data.tabs).map(([tab, count]) => `${tab}: ${count}`).join(", ")})` : ""}.`,
      );
      return;
    }

    setStatus(data.error);
  }

  return (
    <section className="mt-8 space-y-4 rounded-xl border bg-white p-6">
      <h2 className="font-medium">OpenAI (from environment)</h2>
      <p className="text-sm text-slate-600">
        Set <code className="rounded bg-slate-100 px-1">OPENAI_API_KEY</code> in{" "}
        <code className="rounded bg-slate-100 px-1">.env.local</code> or Vercel env vars. Used
        server-side for resume parsing and AI field fill.
      </p>
      <p className="text-sm text-slate-700">
        Status: {openaiConfigured ? "configured" : "missing OPENAI_API_KEY"}
      </p>

      <h2 className="pt-4 font-medium">Google Sheet (from environment)</h2>
      <p className="text-sm text-slate-600">
        Configure <code className="rounded bg-slate-100 px-1">GOOGLE_SHEETS_ID</code>,{" "}
        <code className="rounded bg-slate-100 px-1">GOOGLE_REFRESH_TOKEN</code>,{" "}
        <code className="rounded bg-slate-100 px-1">GOOGLE_CLIENT_ID</code>, and{" "}
        <code className="rounded bg-slate-100 px-1">GOOGLE_CLIENT_SECRET</code> in{" "}
        <code className="rounded bg-slate-100 px-1">.env.local</code> or Vercel env vars.
      </p>
      <p className="text-sm text-slate-700">
        Status:{" "}
        {sheetConfigured
          ? `configured${spreadsheetId ? ` (${spreadsheetId})` : ""}`
          : "missing required env vars"}
      </p>
      <p className="text-sm text-slate-700">
        Tabs: {sheetTabNames.length > 0 ? sheetTabNames.join(", ") : "For Resume"}
      </p>
      <p className="text-sm text-slate-700">
        Last sync:{" "}
        {lastSheetSyncAt
          ? `${new Date(lastSheetSyncAt).toLocaleString()} (${syncedJobCount} jobs cached)`
          : "not synced yet for this account"}
      </p>
      <button
        type="button"
        onClick={syncSheet}
        disabled={loading || !sheetConfigured}
        className="rounded-lg border border-slate-300 px-4 py-2 hover:bg-slate-50 disabled:opacity-50"
      >
        {loading ? "Syncing..." : "Sync sheet tabs"}
      </button>

      {status ? <p className="text-sm text-slate-700">{status}</p> : null}
    </section>
  );
}
