import { isRuntimeAvailable } from "./extension-context";

const BLOCKED_HOST_SUFFIXES = [
  "vercel.com",
  "vercel.app",
  "github.com",
  "supabase.com",
  "accounts.google.com",
];

export function shouldActivateContentScript(): boolean {
  if (!isRuntimeAvailable()) {
    return false;
  }

  const hostname = window.location.hostname.replace(/^www\./i, "").toLowerCase();
  const port = window.location.port;

  if (BLOCKED_HOST_SUFFIXES.some((suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`))) {
    return false;
  }

  if (hostname === "localhost" && (port === "3000" || port === "")) {
    return false;
  }

  if (hostname === "127.0.0.1" && port === "3000") {
    return false;
  }

  return true;
}
