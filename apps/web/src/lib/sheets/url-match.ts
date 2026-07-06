import { normalizeUrl } from "@/lib/crypto";

const STRONG_SIGNATURE_PREFIXES = [
  "greenhouse:job:",
  "lever:job:",
  "ashby:job:",
  "workday:job:",
  "linkedin:job:",
  "smartrecruiters:job:",
  "numeric-job:",
  "path-job:",
] as const;

export function normalizeSheetUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

export function getUrlMatchSignatures(url: string): Set<string> {
  const signatures = new Set<string>();
  const normalizedInput = normalizeSheetUrl(url);

  if (!normalizedInput) {
    return signatures;
  }

  signatures.add(normalizeUrl(normalizedInput));

  try {
    const parsed = new URL(normalizedInput);
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    const path = parsed.pathname.replace(/\/+$/, "").toLowerCase();

    signatures.add(`${host}${path}`);

    const ghPathId = path.match(/\/jobs\/(\d+)/)?.[1];
    const ghQueryId = parsed.searchParams.get("gh_jid");
    const greenhouseId = ghPathId || ghQueryId;
    if (greenhouseId) {
      signatures.add(`greenhouse:job:${greenhouseId}`);
    }

    const leverId = path.match(
      /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
    )?.[1];
    if (leverId) {
      signatures.add(`lever:job:${leverId.toLowerCase()}`);
    }

    const ashbyId = parsed.searchParams.get("ashby_jid");
    if (ashbyId) {
      signatures.add(`ashby:job:${ashbyId}`);
    }

    const workdayId =
      parsed.searchParams.get("jobPostingId") ||
      parsed.searchParams.get("jobId") ||
      parsed.searchParams.get("selected_job_id");
    if (workdayId) {
      signatures.add(`workday:job:${workdayId}`);
    }

    const linkedInId = path.match(/\/jobs\/view\/(\d+)/)?.[1];
    if (linkedInId) {
      signatures.add(`linkedin:job:${linkedInId}`);
    }

    const smartRecruitersId = path.match(/\/([^/]+)\/(\d{10,})/)?.[2];
    if (smartRecruitersId) {
      signatures.add(`smartrecruiters:job:${smartRecruitersId}`);
    }

    const pathSegments = path.split("/").filter(Boolean);
    const lastSegment = pathSegments[pathSegments.length - 1];
    if (lastSegment) {
      if (/^\d{5,}$/.test(lastSegment)) {
        signatures.add(`numeric-job:${lastSegment}`);
      } else if (/^[0-9a-f-]{20,}$/i.test(lastSegment)) {
        signatures.add(`path-job:${lastSegment.toLowerCase()}`);
      }
    }
  } catch {
    signatures.add(normalizedInput.toLowerCase());
  }

  return signatures;
}

function getStrongSignatures(url: string): Set<string> {
  const strong = new Set<string>();
  for (const signature of getUrlMatchSignatures(url)) {
    if (STRONG_SIGNATURE_PREFIXES.some((prefix) => signature.startsWith(prefix))) {
      strong.add(signature);
    }
  }
  return strong;
}

export function urlsMatchForJobLookup(sheetUrl: string, applicationUrl: string): boolean {
  const sheetSignatures = getUrlMatchSignatures(sheetUrl);
  const appSignatures = getUrlMatchSignatures(applicationUrl);

  for (const signature of sheetSignatures) {
    if (appSignatures.has(signature)) {
      return true;
    }
  }

  const sheetStrong = getStrongSignatures(sheetUrl);
  const appStrong = getStrongSignatures(applicationUrl);
  for (const signature of sheetStrong) {
    if (appStrong.has(signature)) {
      return true;
    }
  }

  return false;
}

export function getUrlSearchHints(url: string): string[] {
  const hints = new Set<string>();

  try {
    const parsed = new URL(normalizeSheetUrl(url));
    hints.add(parsed.hostname.replace(/^www\./i, ""));

    const ghId =
      parsed.pathname.match(/\/jobs\/(\d+)/)?.[1] || parsed.searchParams.get("gh_jid");
    if (ghId) hints.add(ghId);

    const leverId = parsed.pathname.match(
      /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
    )?.[1];
    if (leverId) hints.add(leverId);

    const ashbyId = parsed.searchParams.get("ashby_jid");
    if (ashbyId) hints.add(ashbyId);

    const lastSegment = parsed.pathname.split("/").filter(Boolean).pop();
    if (lastSegment && (/^\d{5,}$/.test(lastSegment) || lastSegment.length >= 20)) {
      hints.add(lastSegment);
    }
  } catch {
    hints.add(url.trim());
  }

  return [...hints].filter((hint) => hint.length >= 4);
}
