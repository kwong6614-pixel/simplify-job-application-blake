"use client";

import { useEffect, useState } from "react";

const SESSION_TOKEN_KEY = "jobapply.extensionToken";

export default function ExtensionClient() {
  const [token, setToken] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedToken = sessionStorage.getItem(SESSION_TOKEN_KEY);
    if (savedToken) {
      setToken(savedToken);
    }

    fetch("/api/extension/token")
      .then((response) => response.json())
      .then((data) => {
        setConnected(Boolean(data.connected));
      })
      .catch(() => undefined);
  }, []);

  async function createToken() {
    setError(null);
    setLoading(true);

    const response = await fetch("/api/extension/token", { method: "POST" });
    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? "Failed to create token");
      return;
    }

    setToken(data.token);
    sessionStorage.setItem(SESSION_TOKEN_KEY, data.token);
    setConnected(true);
  }

  return (
    <section className="mt-8 rounded-xl border bg-white p-6">
      <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700">
        <li>Load the extension from `apps/extension/dist` in Chrome.</li>
        <li>Create a token below and paste it into the extension popup.</li>
        <li>Click <strong>Save connection</strong> in the extension popup.</li>
        <li>Open ATS application tabs and use Fill in the popup.</li>
      </ol>

      {connected ? (
        <p className="mt-4 rounded-md bg-green-50 p-3 text-sm text-green-800">
          Extension connected.
        </p>
      ) : null}

      <button
        type="button"
        onClick={createToken}
        disabled={loading}
        className="mt-6 rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-500 disabled:opacity-60"
      >
        {loading ? "Creating..." : connected ? "Create new token" : "Connect extension"}
      </button>

      {token ? (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium text-slate-800">Copy this token into the extension popup:</p>
          <p className="break-all rounded-md bg-slate-100 p-3 text-xs">{token}</p>
        </div>
      ) : connected ? (
        <p className="mt-4 text-sm text-slate-600">
          Your existing token is still active. Create a new one only if you lost it.
        </p>
      ) : null}

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
