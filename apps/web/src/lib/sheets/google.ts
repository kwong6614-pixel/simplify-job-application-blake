import { google } from "googleapis";
import { prisma } from "@/lib/db";
import { normalizeUrl, sheetRowHash } from "@/lib/crypto";
import { getGoogleSheetEnvConfig } from "@/lib/sheets/config";
import {
  extractAshbyJobUuid,
  getUrlSearchHints,
  MIN_MATCH_SCORE,
  normalizeSheetUrl,
  scoreUrlMatch,
} from "@/lib/sheets/url-match";
import { getCachedMatch, invalidateUserMatchCache, setCachedMatch } from "@/lib/sheets/match-cache";

const UPSERT_BATCH_SIZE = 25;

function getOAuthClient(clientId: string, clientSecret: string) {
  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    `${process.env.NEXTAUTH_URL}/api/sheets/callback`,
  );
}

function getSheetRange(sheetTabName: string): string {
  return `'${sheetTabName.replace(/'/g, "''")}'!A2:J`;
}

type SheetRow = {
  date?: string;
  company?: string;
  role?: string;
  techStack?: string;
  url?: string;
  responsibilities?: string;
  qualificationsRequired?: string;
  qualificationsPreferred?: string;
  submittedBy?: string;
};

type PreparedSheetJob = {
  userId: string;
  sheetRowHash: string;
  date: string | null;
  company: string;
  role: string;
  techStack: string | null;
  url: string;
  urlNormalized: string;
  responsibilities: string;
  qualificationsRequired: string;
  qualificationsPreferred: string;
  submittedBy: string | null;
};

function parseSheetRow(row: string[]): SheetRow {
  const [
    date,
    company,
    role,
    techStack,
    url,
    responsibilities,
    qualificationsRequired,
    qualificationsPreferred,
    ,
    submittedBy,
  ] = row;

  return {
    date,
    company,
    role,
    techStack,
    url,
    responsibilities,
    qualificationsRequired,
    qualificationsPreferred,
    submittedBy,
  };
}

function prepareSheetJob(
  userId: string,
  sheetTabName: string,
  row: SheetRow,
): PreparedSheetJob | null {
  const { company, url } = row;
  if (!url || !company) {
    return null;
  }

  const normalizedUrl = normalizeSheetUrl(url);
  const hash = sheetRowHash([
    sheetTabName,
    row.date ?? "",
    company,
    row.role ?? "",
    row.techStack ?? "",
    normalizedUrl,
    row.responsibilities ?? "",
    row.qualificationsRequired ?? "",
    row.qualificationsPreferred ?? "",
    row.submittedBy ?? "",
  ]);

  return {
    userId,
    sheetRowHash: hash,
    date: row.date ?? null,
    company,
    role: row.role ?? "",
    techStack: row.techStack ?? null,
    url: normalizedUrl,
    urlNormalized: normalizeUrl(normalizedUrl),
    responsibilities: row.responsibilities ?? "",
    qualificationsRequired: row.qualificationsRequired ?? "",
    qualificationsPreferred: row.qualificationsPreferred ?? "",
    submittedBy: row.submittedBy ?? null,
  };
}

async function upsertPreparedJobs(jobs: PreparedSheetJob[]): Promise<number> {
  let upserted = 0;
  const syncedAt = new Date();

  for (let index = 0; index < jobs.length; index += UPSERT_BATCH_SIZE) {
    const batch = jobs.slice(index, index + UPSERT_BATCH_SIZE);

    await Promise.all(
      batch.map((job) =>
        prisma.sheetJob.upsert({
          where: {
            userId_sheetRowHash: {
              userId: job.userId,
              sheetRowHash: job.sheetRowHash,
            },
          },
          create: job,
          update: {
            date: job.date,
            company: job.company,
            role: job.role,
            techStack: job.techStack,
            url: job.url,
            urlNormalized: job.urlNormalized,
            responsibilities: job.responsibilities,
            qualificationsRequired: job.qualificationsRequired,
            qualificationsPreferred: job.qualificationsPreferred,
            submittedBy: job.submittedBy,
            syncedAt,
          },
        }),
      ),
    );

    upserted += batch.length;
  }

  return upserted;
}

export async function getAuthorizedSheetsClient() {
  const config = getGoogleSheetEnvConfig();
  const client = getOAuthClient(config.clientId, config.clientSecret);
  client.setCredentials({
    refresh_token: config.refreshToken,
  });

  return {
    sheets: google.sheets({ version: "v4", auth: client }),
    spreadsheetId: config.spreadsheetId,
  };
}

export async function fetchSheetRowsByTab(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  sheetTabNames: string[],
): Promise<Record<string, string[][]>> {
  const ranges = sheetTabNames.map((tabName) => getSheetRange(tabName));
  const response = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges,
  });

  const valueRanges = response.data.valueRanges ?? [];
  const rowsByTab: Record<string, string[][]> = {};

  sheetTabNames.forEach((tabName, index) => {
    rowsByTab[tabName] = valueRanges[index]?.values ?? [];
  });

  return rowsByTab;
}

export async function syncSheetJobsFromRows(
  userId: string,
  rowsByTab: Record<string, string[][]>,
  sheetTabNames: string[],
): Promise<{ synced: number; tabs: Record<string, number> }> {
  const tabs: Record<string, number> = {};
  const preparedJobs: PreparedSheetJob[] = [];

  for (const sheetTabName of sheetTabNames) {
    const rows = rowsByTab[sheetTabName] ?? [];
    let tabCount = 0;

    for (const row of rows) {
      const parsed = parseSheetRow(row);
      const prepared = prepareSheetJob(userId, sheetTabName, parsed);
      if (prepared) {
        preparedJobs.push(prepared);
        tabCount += 1;
      }
    }

    tabs[sheetTabName] = tabCount;
  }

  const synced = await upsertPreparedJobs(preparedJobs);
  await recordSheetSyncForUser(userId);
  invalidateUserMatchCache(userId);
  return { synced, tabs };
}

export async function recordSheetSyncForUser(userId: string): Promise<Date> {
  const lastSheetSyncAt = new Date();
  await prisma.profile.update({
    where: { userId },
    data: { lastSheetSyncAt },
  });
  return lastSheetSyncAt;
}

export async function syncSheetJobsForUser(userId: string): Promise<{
  synced: number;
  tabs: Record<string, number>;
}> {
  const config = getGoogleSheetEnvConfig();
  const { sheets, spreadsheetId } = await getAuthorizedSheetsClient();
  const rowsByTab = await fetchSheetRowsByTab(sheets, spreadsheetId, config.sheetTabNames);
  return syncSheetJobsFromRows(userId, rowsByTab, config.sheetTabNames);
}

export async function matchJobByUrl(userId: string, url: string) {
  const normalized = normalizeUrl(normalizeSheetUrl(url));

  const cached = getCachedMatch(userId, normalized);
  if (cached !== undefined) {
    return cached;
  }

  const mapping = await prisma.urlMapping.findUnique({
    where: { userId_appUrlNormalized: { userId, appUrlNormalized: normalized } },
    select: { sheetJobId: true },
  });

  if (mapping) {
    const job = await prisma.sheetJob.findFirst({
      where: { userId, id: mapping.sheetJobId },
    });
    setCachedMatch(userId, normalized, job);
    return job;
  }

  const exact = await prisma.sheetJob.findFirst({
    where: { userId, urlNormalized: normalized },
  });
  if (exact) {
    setCachedMatch(userId, normalized, exact);
    return exact;
  }

  const hints = getUrlSearchHints(url).sort((a, b) => b.length - a.length);
  const primaryHint = hints[0];

  if (primaryHint) {
    const candidates = await prisma.sheetJob.findMany({
      where: {
        userId,
        url: { contains: primaryHint, mode: "insensitive" },
      },
      orderBy: { syncedAt: "desc" },
      take: 8,
    });

    let bestJob: (typeof candidates)[number] | null = null;
    let bestScore = 0;
    for (const job of candidates) {
      const score = scoreUrlMatch(job.url, url);
      if (score > bestScore) {
        bestScore = score;
        bestJob = job;
      }
    }

    if (bestJob && bestScore >= MIN_MATCH_SCORE) {
      setCachedMatch(userId, normalized, bestJob);
      return bestJob;
    }
  }

  const ashbyUuid = extractAshbyJobUuid(url);
  if (ashbyUuid && ashbyUuid !== primaryHint) {
    const ashbyJob = await prisma.sheetJob.findFirst({
      where: {
        userId,
        url: { contains: ashbyUuid, mode: "insensitive" },
      },
      orderBy: { syncedAt: "desc" },
    });
    if (ashbyJob && scoreUrlMatch(ashbyJob.url, url) >= MIN_MATCH_SCORE) {
      setCachedMatch(userId, normalized, ashbyJob);
      return ashbyJob;
    }
  }

  setCachedMatch(userId, normalized, null);
  return null;
}

export async function rememberApplicationUrl(
  userId: string,
  sheetJobId: string,
  applicationUrl: string,
) {
  const appUrlNormalized = normalizeUrl(normalizeSheetUrl(applicationUrl));
  await prisma.urlMapping.upsert({
    where: { userId_appUrlNormalized: { userId, appUrlNormalized } },
    create: { userId, sheetJobId, applicationUrl, appUrlNormalized },
    update: { sheetJobId, applicationUrl },
  });

  const job = await prisma.sheetJob.findFirst({
    where: { userId, id: sheetJobId },
  });
  if (job) {
    setCachedMatch(userId, appUrlNormalized, job);
  }
}
