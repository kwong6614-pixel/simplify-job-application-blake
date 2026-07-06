// Standalone URL match test — run: node scripts/test-ashby-match.mjs

const PRESERVED_URL_PARAMS = ["for", "token", "gh_jid", "jr_id", "ashby_jid", "jobPostingId", "jobId", "selected_job_id"];

function normalizeSheetUrl(url) {
  const trimmed = url.replace(/\s+/g, " ").trim();
  if (!trimmed) return trimmed;
  if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

function canonicalAshbyPathname(pathname) {
  let path = pathname.replace(/\/+$/, "") || "/";
  if (/\/application$/i.test(path)) {
    path = path.replace(/\/application$/i, "") || "/";
  }
  return path.toLowerCase();
}

function normalizeUrl(url) {
  try {
    const parsed = new URL(normalizeSheetUrl(url));
    parsed.hash = "";
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    const kept = new URLSearchParams();
    for (const key of PRESERVED_URL_PARAMS) {
      if (host.includes("ashbyhq.com") && key === "jr_id") continue;
      const value = parsed.searchParams.get(key)?.trim();
      if (value) kept.set(key, value.toLowerCase());
    }
    const sorted = [...kept.entries()].sort(([a], [b]) => a.localeCompare(b));
    parsed.search = sorted.length > 0 ? `?${new URLSearchParams(sorted).toString()}` : "";
    parsed.pathname = host.includes("ashbyhq.com")
      ? canonicalAshbyPathname(parsed.pathname)
      : parsed.pathname.replace(/\/+$/, "") || "/";
    return parsed.toString().toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

function extractAshbyJobUuid(url) {
  try {
    const path = new URL(normalizeSheetUrl(url)).pathname;
    return path.match(/\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)?.[1]?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

const app =
  "https://jobs.ashbyhq.com/butterflymx/92959bb6-9ea3-402b-b55f-39a7d8ad8585/application?utm_source=jobright&jr_id=6a4324ab3a9004648946ab2e";
const variants = [
  app,
  `${app}  `,
  "https://jobs.ashbyhq.com/butterflymx/92959bb6-9ea3-402b-b55f-39a7d8ad8585/application",
  "https://jobs.ashbyhq.com/butterflymx/92959bb6-9ea3-402b-b55f-39a7d8ad8585",
];

for (const sheet of variants) {
  console.log("\n--- sheet:", sheet);
  console.log("norm sheet:", normalizeUrl(sheet));
  console.log("norm app: ", normalizeUrl(app));
  console.log("same norm:", normalizeUrl(sheet) === normalizeUrl(app));
  console.log("uuid sheet:", extractAshbyJobUuid(sheet));
  console.log("uuid app: ", extractAshbyJobUuid(app));
}
