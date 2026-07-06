"use client";

import { useEffect, useState } from "react";

type ExtensionTokenInfo = {
  id: string;
  label: string | null;
  expiresAt: string;
  lastUsedAt: string | null;
  createdAt: string;
};

const SESSION_TOKEN_KEY = "jobapply.extensionToken";

export default function ExtensionClient() {
  const [token, setToken] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [tokens, setTokens] = useState<ExtensionTokenInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = sessionStorage.getItem(SESSION_TOKEN_KEY);
    if (savedToken) {
      setToken(savedToken);
    }

    fetch("/api/extension/token")
      .then((response) => response.json())
      .then((data) => {
        setConnected(Boolean(data.connected));
        setTokens(Array.isArray(data.tokens) ? data.tokens : []);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
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

    const statusResponse = await fetch("/api/extension/token");
    const statusData = await statusResponse.json();
    setTokens(Array.isArray(statusData.tokens) ? statusData.tokens : []);
  }

  return (
    <section className="mt-8 rounded-xl border bg-white p-6">
      <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700">
        <li>Load the extension from `apps/extension/dist` in Chrome.</li>
        <li>Create or reuse a token below and paste it into the extension popup.</li>
        <li>Click <strong>Save connection</strong> in the extension popup.</li>
        <li>Open ATS application tabs and use Fill in the popup.</li>
      </ol>

      {loading ? <p className="mt-4 text-sm text-slate-600">Checking extension connection...</p> : null}

      {!loading && connected ? (
        <p className="mt-4 rounded-md bg-green-50 p-3 text-sm text-green-800">
          Extension connected. Your saved token remains active until it expires.
        </p>
      ) : null}

      {!loading && tokens.length > 0 ? (
        <ul className="mt-4 space-y-2 text-xs text-slate-600">
          {tokens.map((entry) => (
            <li key={entry.id} className="rounded-md bg-slate-50 p-3">
              {entry.label ?? "Chrome extension"} · expires{" "}
              {new Date(entry.expiresAt).toLocaleDateString()}
              {entry.lastUsedAt
                ? ` · last used ${new Date(entry.lastUsedAt).toLocaleString()}`
                : " · not used yet"}
            </li>
          ))}
        </ul>
      ) : null}

      <button
        type="button"
        onClick={createToken}
        disabled={loading}
        className="mt-6 rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-500 disabled:opacity-60"
      >
        {connected ? "Create new extension token" : "Connect extension"}
      </button>

      {token ? (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium text-slate-800">Copy this token into the extension popup:</p>
          <p className="break-all rounded-md bg-slate-100 p-3 text-xs">{token}</p>
          <p className="text-xs text-slate-500">
            This token stays visible until you close the browser tab. After refresh in the same tab,
            it is restored from session storage.
          </p>
        </div>
      ) : connected ? (
        <p className="mt-4 text-sm text-slate-600">
          Your existing token is still active. Create a new one only if you lost it from the
          extension popup.
        </p>
      ) : null}

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
