import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { ensureSheetSyncedForUser } from "@/lib/sheets/auto-sync";
import { isGoogleSheetEnvConfigured, getAutoSyncSheetTabNames } from "@/lib/sheets/config";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let autoSync: { ran: boolean; skipped: boolean; synced?: number } | null = null;
  if (isGoogleSheetEnvConfigured()) {
    try {
      const result = await ensureSheetSyncedForUser(session.user.id);
      autoSync = { ran: result.ran, skipped: result.skipped, synced: result.synced };
    } catch {
      autoSync = null;
    }
  }

  const [syncStats, syncedJobCount] = await Promise.all([
    prisma.sheetJob.aggregate({
      where: { userId: session.user.id },
      _max: { syncedAt: true },
    }),
    prisma.sheetJob.count({
      where: { userId: session.user.id },
    }),
  ]);

  return NextResponse.json({
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
    sheetConfigured: isGoogleSheetEnvConfigured(),
    spreadsheetId: process.env.GOOGLE_SHEETS_ID ?? null,
    sheetTabNames: getAutoSyncSheetTabNames(),
    lastSheetSyncAt: syncStats._max.syncedAt?.toISOString() ?? null,
    syncedJobCount,
    autoSyncEnabled: isGoogleSheetEnvConfigured(),
    lastAutoSync: autoSync,
  });
}
