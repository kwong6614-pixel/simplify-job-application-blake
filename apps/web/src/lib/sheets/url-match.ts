import { normalizeUrl } from "@/lib/crypto";

const STRONG_SIGNATURE_PREFIXES = [
  "greenhouse:job:",
  "greenhouse:jr_id:",
  "greenhouse:",
  "lever:job:",
  "ashby:job:",
  "workday:job:",
  "linkedin:job:",
  "smartrecruiters:job:",
  "workable:job:",
  "rippling:job:",
  "gusto:posting:",
  "numeric-job:",
  "path-job:",
] as const;

const MIN_MATCH_SCORE = 80;

export function normalizeSheetUrl(url: string): string {
  const trimmed = url.replace(/\s+/g, " ").trim();
  if (!trimmed) return trimmed;
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

const ASHBY_JOB_UUID =
  /\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

export function extractAshbyJobUuid(url: string): string | null {
  try {
    const path = new URL(normalizeSheetUrl(url)).pathname;
    return path.match(ASHBY_JOB_UUID)?.[1]?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

function addGreenhouseSignatures(
  parsed: URL,
  path: string,
  signatures: Set<string>,
): void {
  const forSlug = parsed.searchParams.get("for")?.trim().toLowerCase();
  const jrId = parsed.searchParams.get("jr_id")?.trim().toLowerCase();
  const embedToken = parsed.searchParams.get("token")?.trim();
  const ghJid = parsed.searchParams.get("gh_jid")?.trim();
  const ghPathId = path.match(/\/jobs\/(\d+)/)?.[1];

  const numericJobId =
    ghPathId ||
    ghJid ||
    (embedToken && /^\d+$/.test(embedToken) ? embedToken : null);

  if (numericJobId) {
    signatures.add(`greenhouse:job:${numericJobId}`);
  }

  if (jrId) {
    signatures.add(`greenhouse:jr_id:${jrId}`);
    signatures.add(`path-job:${jrId}`);
  }

  if (forSlug && numericJobId) {
    signatures.add(`greenhouse:${forSlug}:${numericJobId}`);
  }

  if (forSlug && jrId) {
    signatures.add(`greenhouse:${forSlug}:${jrId}`);
  }

  const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
  const hosted = host.match(/^([^.]+)\.greenhouse\.io$/);
  if (hosted && numericJobId) {
    signatures.add(`greenhouse:${hosted[1].toLowerCase()}:${numericJobId}`);
  }

  const boards = path.match(/^\/([^/]+)\/jobs\/(\d+)/);
  if (boards) {
    signatures.add(`greenhouse:${boards[1].toLowerCase()}:${boards[2]}`);
    signatures.add(`greenhouse:job:${boards[2]}`);
  }
}

function addWorkableSignatures(parsed: URL, path: string, signatures: Set<string>): void {
  const shortcode = path.match(/\/j\/([a-z0-9]+)/i)?.[1];
  if (shortcode) {
    signatures.add(`workable:job:${shortcode.toUpperCase()}`);
    signatures.add(`path-job:${shortcode.toLowerCase()}`);
  }
}

function addRipplingSignatures(path: string, signatures: Set<string>): void {
  const jobId = path.match(/\/jobs\/([0-9a-f-]{36})/i)?.[1];
  if (jobId) {
    signatures.add(`rippling:job:${jobId.toLowerCase()}`);
    signatures.add(`path-job:${jobId.toLowerCase()}`);
  }
}

function addGustoSignatures(path: string, signatures: Set<string>): void {
  const postingUuid = path.match(ASHBY_JOB_UUID)?.[1];
  if (postingUuid) {
    signatures.add(`gusto:posting:${postingUuid.toLowerCase()}`);
    signatures.add(`path-job:${postingUuid.toLowerCase()}`);
  }
}

function addAshbySignatures(parsed: URL, path: string, signatures: Set<string>): void {
  const ashbyQueryId = parsed.searchParams.get("ashby_jid")?.trim().toLowerCase();
  if (ashbyQueryId) {
    signatures.add(`ashby:job:${ashbyQueryId}`);
  }

  const ashbyUuid = path.match(ASHBY_JOB_UUID)?.[1];
  if (ashbyUuid) {
    signatures.add(`ashby:job:${ashbyUuid.toLowerCase()}`);
  }

  const companySlug = path.match(/^\/([^/]+)\/([0-9a-f-]{36})/i);
  if (companySlug) {
    signatures.add(`ashby:${companySlug[1].toLowerCase()}:${companySlug[2].toLowerCase()}`);
  }

  const canonicalPath = path.replace(/\/application\/?$/i, "");
  if (canonicalPath !== path && ashbyUuid) {
    signatures.add(`ashby:job:${ashbyUuid.toLowerCase()}`);
  }
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

    if (host.includes("greenhouse.io")) {
      addGreenhouseSignatures(parsed, path, signatures);
    } else {
      const ghQueryId = parsed.searchParams.get("gh_jid");
      if (ghQueryId && /^\d+$/.test(ghQueryId)) {
        signatures.add(`greenhouse:job:${ghQueryId}`);
      }
    }

    if (host.includes("ashbyhq.com")) {
      addAshbySignatures(parsed, path, signatures);
    } else {
      const ashbyQueryId = parsed.searchParams.get("ashby_jid");
      if (ashbyQueryId) {
        signatures.add(`ashby:job:${ashbyQueryId.toLowerCase()}`);
      }
    }

    if (host.includes("workable.com")) {
      addWorkableSignatures(parsed, path, signatures);
    }

    if (host.includes("rippling.com")) {
      addRipplingSignatures(path, signatures);
    }

    if (host.includes("gusto.com")) {
      addGustoSignatures(path, signatures);
    }

    const leverId =
      host.includes("lever.co") &&
      path.match(
        /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
      )?.[1];
    if (leverId) {
      signatures.add(`lever:job:${leverId.toLowerCase()}`);
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
      if (/^\d{4,}$/.test(lastSegment)) {
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

function scoreSharedSignature(signature: string): number {
  if (signature.startsWith("ashby:") && signature.split(":").length === 3) {
    const middle = signature.split(":")[1];
    if (middle !== "job") {
      return 95;
    }
  }

  if (signature.startsWith("greenhouse:") && signature.split(":").length === 3) {
    const middle = signature.split(":")[1];
    if (middle !== "job" && middle !== "jr_id") {
      return 95;
    }
  }

  if (
    signature.startsWith("greenhouse:job:") ||
    signature.startsWith("ashby:job:") ||
    signature.startsWith("lever:job:") ||
    signature.startsWith("workday:job:") ||
    signature.startsWith("linkedin:job:") ||
    signature.startsWith("smartrecruiters:job:") ||
    signature.startsWith("workable:job:") ||
    signature.startsWith("rippling:job:") ||
    signature.startsWith("gusto:posting:")
  ) {
    return 90;
  }

  if (signature.startsWith("greenhouse:jr_id:") || signature.startsWith("path-job:")) {
    return 85;
  }

  if (STRONG_SIGNATURE_PREFIXES.some((prefix) => signature.startsWith(prefix))) {
    return 80;
  }

  return 0;
}

export function scoreUrlMatch(sheetUrl: string, applicationUrl: string): number {
  const sheetNormalized = normalizeUrl(normalizeSheetUrl(sheetUrl));
  const appNormalized = normalizeUrl(normalizeSheetUrl(applicationUrl));
  if (sheetNormalized === appNormalized) {
    return 100;
  }

  const sheetUuid = extractAshbyJobUuid(sheetUrl);
  const appUuid = extractAshbyJobUuid(applicationUrl);
  if (sheetUuid && appUuid && sheetUuid === appUuid) {
    return 100;
  }

  const sheetSignatures = getUrlMatchSignatures(sheetUrl);
  const appSignatures = getUrlMatchSignatures(applicationUrl);

  let best = 0;
  for (const signature of sheetSignatures) {
    if (!appSignatures.has(signature)) continue;
    best = Math.max(best, scoreSharedSignature(signature));
  }

  return best;
}

export function urlsMatchForJobLookup(sheetUrl: string, applicationUrl: string): boolean {
  return scoreUrlMatch(sheetUrl, applicationUrl) >= MIN_MATCH_SCORE;
}

export function getUrlSearchHints(url: string): string[] {
  const hints = new Set<string>();

  try {
    const parsed = new URL(normalizeSheetUrl(url));
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    const path = parsed.pathname.replace(/\/+$/, "").toLowerCase();

    const forSlug = parsed.searchParams.get("for");
    const jrId = parsed.searchParams.get("jr_id");
    const embedToken = parsed.searchParams.get("token");
    const ghId =
      path.match(/\/jobs\/(\d+)/)?.[1] ||
      parsed.searchParams.get("gh_jid") ||
      (embedToken && /^\d+$/.test(embedToken) ? embedToken : null);

    if (ghId) hints.add(ghId);
    if (jrId && jrId.length >= 6) hints.add(jrId);
    if (forSlug && ghId) hints.add(`${forSlug}/jobs/${ghId}`);

    const boards = path.match(/^\/([^/]+)\/jobs\/(\d+)/);
    if (boards) {
      hints.add(boards[2]);
      hints.add(`${boards[1]}/jobs/${boards[2]}`);
    }

    const ashbyId =
      parsed.searchParams.get("ashby_jid") ||
      path.match(ASHBY_JOB_UUID)?.[1];
    if (ashbyId) {
      hints.add(ashbyId);
      const ashbyCompany = path.match(/^\/([^/]+)\/[0-9a-f-]{36}/i)?.[1];
      if (ashbyCompany) {
        hints.add(`${ashbyCompany}/${ashbyId}`);
      }
    }

    const leverId =
      host.includes("lever.co") &&
      path.match(
        /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
      )?.[1];
    if (leverId) hints.add(leverId);

    const workableId = path.match(/\/j\/([a-z0-9]+)/i)?.[1];
    if (workableId && host.includes("workable.com")) {
      hints.add(workableId);
      hints.add(workableId.toUpperCase());
    }

    const ripplingId = path.match(/\/jobs\/([0-9a-f-]{36})/i)?.[1];
    if (ripplingId && host.includes("rippling.com")) {
      hints.add(ripplingId);
    }

    const gustoId = path.match(ASHBY_JOB_UUID)?.[1];
    if (gustoId && host.includes("gusto.com")) {
      hints.add(gustoId);
    }

    const workdayId =
      parsed.searchParams.get("jobPostingId") ||
      parsed.searchParams.get("jobId") ||
      parsed.searchParams.get("selected_job_id");
    if (workdayId) hints.add(workdayId);

    const lastSegment = path.split("/").filter(Boolean).pop();
    if (lastSegment && /^\d{6,}$/.test(lastSegment)) {
      hints.add(lastSegment);
    }
    if (lastSegment && /^[a-z0-9]{8,}$/i.test(lastSegment) && host.includes("workable.com")) {
      hints.add(lastSegment);
      hints.add(lastSegment.toUpperCase());
    }
  } catch {
    hints.add(url.trim());
  }

  return [...hints].filter((hint) => hint.length >= 4);
}

export { MIN_MATCH_SCORE };
