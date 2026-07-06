import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { getGoogleSheetEnvConfig, getAutoSyncSheetTabNames, isGoogleSheetEnvConfigured } from "@/lib/sheets/config";
import {
  fetchSheetRowsByTab,
  getAuthorizedSheetsClient,
  syncSheetJobsFromRows,
} from "@/lib/sheets/google";

export type AutoSyncResult = {
  ran: boolean;
  skipped: boolean;
  reason?: "not_configured" | "up_to_date";
  synced?: number;
  tabs?: Record<string, number>;
};

const inFlightByKey = new Map<string, Promise<AutoSyncResult>>();

function computeSheetFingerprint(
  rowsByTab: Record<string, string[][]>,
  sheetTabNames: string[],
): string {
  const payload = sheetTabNames
    .map((tabName) => `${tabName}\n${JSON.stringify(rowsByTab[tabName] ?? [])}`)
    .join("\n---\n");
  return createHash("sha256").update(payload).digest("hex");
}

async function userNeedsSync(
  userId: string,
  spreadsheetId: string,
  fingerprint: string,
  force: boolean,
): Promise<boolean> {
  if (force) return true;

  const [userStats, meta] = await Promise.all([
    prisma.sheetJob.aggregate({
      where: { userId },
      _max: { syncedAt: true },
      _count: true,
    }),
    prisma.googleSheetSyncMeta.findUnique({
      where: { spreadsheetId },
    }),
  ]);

  if (userStats._count === 0) return true;
  if (!meta) return true;
  if (meta.contentFingerprint !== fingerprint) return true;
  if (!userStats._max.syncedAt) return true;

  return userStats._max.syncedAt < meta.updatedAt;
}

async function runAutoSync(userId: string, force: boolean): Promise<AutoSyncResult> {
  const config = getGoogleSheetEnvConfig();
  const autoSyncTabNames = getAutoSyncSheetTabNames();
  const { sheets, spreadsheetId } = await getAuthorizedSheetsClient();
  const rowsByTab = await fetchSheetRowsByTab(sheets, spreadsheetId, autoSyncTabNames);
  const fingerprint = computeSheetFingerprint(rowsByTab, autoSyncTabNames);

  const needsSync = await userNeedsSync(userId, spreadsheetId, fingerprint, force);
  if (!needsSync) {
    return { ran: false, skipped: true, reason: "up_to_date" };
  }

  const result = await syncSheetJobsFromRows(userId, rowsByTab, autoSyncTabNames);

  await prisma.googleSheetSyncMeta.upsert({
    where: { spreadsheetId },
    create: { spreadsheetId, contentFingerprint: fingerprint },
    update: { contentFingerprint: fingerprint },
  });

  return { ran: true, skipped: false, synced: result.synced, tabs: result.tabs };
}

/**
 * Syncs the For Resume tab when:
 * - this user has never synced, or
 * - For Resume tab content changed since the last stored fingerprint.
 */
export async function ensureSheetSyncedForUser(
  userId: string,
  options?: { force?: boolean },
): Promise<AutoSyncResult> {
  if (!isGoogleSheetEnvConfigured()) {
    return { ran: false, skipped: true, reason: "not_configured" };
  }

  const config = getGoogleSheetEnvConfig();
  const lockKey = `${config.spreadsheetId}:${userId}`;

  const inFlight = inFlightByKey.get(lockKey);
  if (inFlight) {
    return inFlight;
  }

  const promise = runAutoSync(userId, Boolean(options?.force)).finally(() => {
    inFlightByKey.delete(lockKey);
  });

  inFlightByKey.set(lockKey, promise);
  return promise;
}
