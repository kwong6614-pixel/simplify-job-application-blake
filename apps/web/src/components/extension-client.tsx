"use client";

import { useState } from "react";

export default function ExtensionClient() {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function createToken() {
    setError(null);
    const response = await fetch("/api/extension/token", { method: "POST" });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Failed to create token");
      return;
    }
    setToken(data.token);
  }

  return (
    <section className="mt-8 rounded-xl border bg-white p-6">
      <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700">
        <li>Load the extension from `apps/extension/dist` in Chrome.</li>
        <li>Click connect below and paste the token into the extension popup.</li>
        <li>Open ATS application tabs and use Fill in the popup.</li>
      </ol>

      <button
        type="button"
        onClick={createToken}
        className="mt-6 rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-500"
      >
        Connect extension
      </button>

      {token ? (
        <p className="mt-4 break-all rounded-md bg-slate-100 p-3 text-xs">
          Copy this token into the extension popup settings: {token}
        </p>
      ) : null}
      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
