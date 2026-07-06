import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function createExtensionToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  return { token, tokenHash };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Query params that identify a specific job posting — preserved when normalizing URLs. */
const PRESERVED_URL_PARAMS = [
  "for",
  "token",
  "gh_jid",
  "jr_id",
  "ashby_jid",
  "jobPostingId",
  "jobId",
  "selected_job_id",
] as const;

function isAshbyHost(hostname: string): boolean {
  return hostname.includes("ashbyhq.com");
}

/** Ashby listing and /application URLs refer to the same posting. */
export function canonicalAshbyPathname(pathname: string): string {
  let path = pathname.replace(/\/+$/, "");
  if (!path) path = "/";
  if (/\/application$/i.test(path)) {
    path = path.replace(/\/application$/i, "") || "/";
  }
  return path.toLowerCase();
}

export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url.trim());
    parsed.hash = "";
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();

    const kept = new URLSearchParams();
    for (const key of PRESERVED_URL_PARAMS) {
      // jr_id on Ashby pages is usually a Jobright/tracker param, not the job id.
      if (isAshbyHost(host) && key === "jr_id") continue;
      const value = parsed.searchParams.get(key)?.trim();
      if (value) {
        kept.set(key, value.toLowerCase());
      }
    }

    const sorted = [...kept.entries()].sort(([a], [b]) => a.localeCompare(b));
    parsed.search = sorted.length > 0 ? `?${new URLSearchParams(sorted).toString()}` : "";

    parsed.pathname = isAshbyHost(host)
      ? canonicalAshbyPathname(parsed.pathname)
      : parsed.pathname.replace(/\/+$/, "") || "/";

    return parsed.toString().toLowerCase();
  } catch {
    return url.replace(/\s+/g, " ").trim().toLowerCase();
  }
}

export function sheetRowHash(values: string[]): string {
  return createHash("sha256").update(values.join("|")).digest("hex");
}
