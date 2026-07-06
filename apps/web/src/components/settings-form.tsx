"use client";

import { useEffect, useState } from "react";

export default function SettingsForm() {
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [sheetConfigured, setSheetConfigured] = useState(false);
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        setSheetConfigured(Boolean(data.sheetConfigured));
        setSpreadsheetId(data.spreadsheetId ?? null);
      })
      .catch(() => undefined);
  }, []);

  async function saveSettings() {
    setLoading(true);
    setStatus(null);
    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ openaiApiKey }),
    });
    setLoading(false);
    setStatus(response.ok ? "Saved OpenAI key." : "Failed to save settings.");
  }

  async function syncSheet() {
    setLoading(true);
    setStatus(null);
    const response = await fetch("/api/jobs/sync", { method: "POST" });
    const data = await response.json();
    setLoading(false);
    setStatus(response.ok ? `Synced ${data.synced} rows.` : data.error);
  }

  return (
    <section className="mt-8 space-y-4 rounded-xl border bg-white p-6">
      <h2 className="font-medium">OpenAI (server-side only)</h2>
      <input
        type="password"
        value={openaiApiKey}
        onChange={(event) => setOpenaiApiKey(event.target.value)}
        placeholder="sk-..."
        className="w-full rounded-md border border-slate-300 px-3 py-2"
      />
      <button
        type="button"
        onClick={saveSettings}
        disabled={loading}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-500"
      >
        Save OpenAI key
      </button>

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
      <button
        type="button"
        onClick={syncSheet}
        disabled={loading || !sheetConfigured}
        className="rounded-lg border border-slate-300 px-4 py-2 hover:bg-slate-50 disabled:opacity-50"
      >
        Sync For Resume tab
      </button>

      {status ? <p className="text-sm text-slate-700">{status}</p> : null}
    </section>
  );
}
