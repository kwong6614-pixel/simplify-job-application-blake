import { google } from "googleapis";
import { prisma } from "@/lib/db";
import { normalizeUrl, sheetRowHash } from "@/lib/crypto";
import { getGoogleSheetEnvConfig } from "@/lib/sheets/config";
import {
  getUrlSearchHints,
  normalizeSheetUrl,
  urlsMatchForJobLookup,
} from "@/lib/sheets/url-match";

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

async function upsertSheetRow(userId: string, sheetTabName: string, row: SheetRow): Promise<boolean> {
  const { company, url } = row;
  if (!url || !company) {
    return false;
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

  await prisma.sheetJob.upsert({
    where: { userId_sheetRowHash: { userId, sheetRowHash: hash } },
    create: {
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
    },
    update: {
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
      syncedAt: new Date(),
    },
  });

  return true;
}

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

export async function syncSheetJobsForUser(userId: string): Promise<{
  synced: number;
  tabs: Record<string, number>;
}> {
  const config = getGoogleSheetEnvConfig();

  const client = getOAuthClient(config.clientId, config.clientSecret);
  client.setCredentials({
    refresh_token: config.refreshToken,
  });

  const sheets = google.sheets({ version: "v4", auth: client });
  const tabs: Record<string, number> = {};
  let synced = 0;

  for (const sheetTabName of config.sheetTabNames) {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: config.spreadsheetId,
      range: getSheetRange(sheetTabName),
    });

    const rows = response.data.values ?? [];
    let tabCount = 0;

    for (const row of rows) {
      const parsed = parseSheetRow(row);
      const upserted = await upsertSheetRow(userId, sheetTabName, parsed);
      if (upserted) {
        tabCount += 1;
        synced += 1;
      }
    }

    tabs[sheetTabName] = tabCount;
  }

  return { synced, tabs };
}

export async function matchJobByUrl(userId: string, url: string) {
  const normalized = normalizeUrl(url);

  const mapping = await prisma.urlMapping.findUnique({
    where: { userId_appUrlNormalized: { userId, appUrlNormalized: normalized } },
  });

  if (mapping) {
    return prisma.sheetJob.findFirst({
      where: { userId, id: mapping.sheetJobId },
    });
  }

  const exact = await prisma.sheetJob.findFirst({
    where: { userId, urlNormalized: normalized },
  });
  if (exact) return exact;

  const hints = getUrlSearchHints(url);
  const candidateJobs =
    hints.length > 0
      ? await prisma.sheetJob.findMany({
          where: {
            userId,
            OR: hints.map((hint) => ({
              url: { contains: hint, mode: "insensitive" as const },
            })),
          },
          orderBy: { syncedAt: "desc" },
          take: 100,
        })
      : [];

  const jobs =
    candidateJobs.length > 0
      ? candidateJobs
      : await prisma.sheetJob.findMany({
          where: { userId },
          orderBy: { syncedAt: "desc" },
          take: 500,
        });

  for (const job of jobs) {
    if (urlsMatchForJobLookup(job.url, url)) {
      return job;
    }
  }

  return null;
}

export async function rememberApplicationUrl(
  userId: string,
  sheetJobId: string,
  applicationUrl: string,
) {
  const appUrlNormalized = normalizeUrl(applicationUrl);
  await prisma.urlMapping.upsert({
    where: { userId_appUrlNormalized: { userId, appUrlNormalized } },
    create: { userId, sheetJobId, applicationUrl, appUrlNormalized },
    update: { sheetJobId, applicationUrl },
  });
}
