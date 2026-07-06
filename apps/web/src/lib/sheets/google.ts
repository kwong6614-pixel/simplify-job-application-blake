import { google } from "googleapis";
import { prisma } from "@/lib/db";
import { normalizeUrl, sheetRowHash } from "@/lib/crypto";
import { getGoogleSheetEnvConfig } from "@/lib/sheets/config";

function getOAuthClient(clientId: string, clientSecret: string) {
  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    `${process.env.NEXTAUTH_URL}/api/sheets/callback`,
  );
}

function getSheetRange(sheetTabName: string): string {
  return `'${sheetTabName}'!A2:J`;
}

export async function syncSheetJobsForUser(userId: string): Promise<number> {
  const config = getGoogleSheetEnvConfig();

  const client = getOAuthClient(config.clientId, config.clientSecret);
  client.setCredentials({
    refresh_token: config.refreshToken,
  });

  const sheets = google.sheets({ version: "v4", auth: client });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: config.spreadsheetId,
    range: getSheetRange(config.sheetTabName),
  });

  const rows = response.data.values ?? [];
  let upserted = 0;

  for (const row of rows) {
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

    if (!url || !company) continue;

    const hash = sheetRowHash([
      date ?? "",
      company ?? "",
      role ?? "",
      techStack ?? "",
      url ?? "",
      responsibilities ?? "",
      qualificationsRequired ?? "",
      qualificationsPreferred ?? "",
      submittedBy ?? "",
    ]);

    await prisma.sheetJob.upsert({
      where: { userId_sheetRowHash: { userId, sheetRowHash: hash } },
      create: {
        userId,
        sheetRowHash: hash,
        date: date ?? null,
        company,
        role: role ?? "",
        techStack: techStack ?? null,
        url,
        urlNormalized: normalizeUrl(url),
        responsibilities: responsibilities ?? "",
        qualificationsRequired: qualificationsRequired ?? "",
        qualificationsPreferred: qualificationsPreferred ?? "",
        submittedBy: submittedBy ?? null,
      },
      update: {
        date: date ?? null,
        company,
        role: role ?? "",
        techStack: techStack ?? null,
        url,
        urlNormalized: normalizeUrl(url),
        responsibilities: responsibilities ?? "",
        qualificationsRequired: qualificationsRequired ?? "",
        qualificationsPreferred: qualificationsPreferred ?? "",
        submittedBy: submittedBy ?? null,
        syncedAt: new Date(),
      },
    });

    upserted += 1;
  }

  return upserted;
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

  return prisma.sheetJob.findFirst({
    where: {
      userId,
      url: { contains: new URL(url).hostname, mode: "insensitive" },
    },
    orderBy: { syncedAt: "desc" },
  });
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
