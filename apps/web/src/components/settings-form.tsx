"use client";

import { useEffect, useState } from "react";

export default function SettingsForm() {
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [spreadsheetId, setSpreadsheetId] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.spreadsheetId) setSpreadsheetId(data.spreadsheetId);
      })
      .catch(() => undefined);
  }, []);

  async function saveSettings() {
    setLoading(true);
    setStatus(null);
    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ openaiApiKey, spreadsheetId }),
    });
    setLoading(false);
    setStatus(response.ok ? "Saved settings." : "Failed to save settings.");
  }

  async function connectGoogleSheet() {
    const response = await fetch("/api/sheets/oauth");
    const data = await response.json();
    if (data.url) window.location.href = data.url;
  }

  async function syncSheet() {
    setLoading(true);
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

      <h2 className="pt-4 font-medium">Google Sheet</h2>
      <input
        value={spreadsheetId}
        onChange={(event) => setSpreadsheetId(event.target.value)}
        placeholder="Spreadsheet ID"
        className="w-full rounded-md border border-slate-300 px-3 py-2"
      />
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={saveSettings}
          disabled={loading}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-500"
        >
          Save
        </button>
        <button
          type="button"
          onClick={connectGoogleSheet}
          className="rounded-lg border border-slate-300 px-4 py-2 hover:bg-slate-50"
        >
          Connect Google OAuth
        </button>
        <button
          type="button"
          onClick={syncSheet}
          className="rounded-lg border border-slate-300 px-4 py-2 hover:bg-slate-50"
        >
          Sync For Resume tab
        </button>
      </div>
      {status ? <p className="text-sm text-slate-700">{status}</p> : null}
    </section>
  );
}
