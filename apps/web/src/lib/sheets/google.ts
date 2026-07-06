import { google } from "googleapis";
import { prisma } from "@/lib/db";
import { normalizeUrl, sheetRowHash } from "@/lib/crypto";
import { SHEET_TAB_NAME } from "@app/shared";

const SHEET_RANGE = `'${SHEET_TAB_NAME}'!A2:J`;

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/sheets/callback`,
  );
}

export function getGoogleAuthUrl(state: string): string {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    state,
  });
}

export async function exchangeGoogleCode(code: string) {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  return tokens;
}

export async function syncSheetJobsForUser(userId: string): Promise<number> {
  const account = await prisma.googleSheetAccount.findUnique({ where: { userId } });
  if (!account?.spreadsheetId) {
    throw new Error("Google Sheet is not connected");
  }

  const client = getOAuthClient();
  client.setCredentials({
    access_token: account.accessToken,
    refresh_token: account.refreshToken,
    expiry_date: account.expiresAt.getTime(),
  });

  const sheets = google.sheets({ version: "v4", auth: client });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: account.spreadsheetId,
    range: SHEET_RANGE,
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

  await prisma.googleSheetAccount.update({
    where: { userId },
    data: { lastSyncedAt: new Date() },
  });

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
