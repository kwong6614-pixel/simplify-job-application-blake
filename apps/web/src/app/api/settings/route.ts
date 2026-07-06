import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isGoogleSheetEnvConfigured, getSheetTabNames } from "@/lib/sheets/config";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    sheetTabNames: getSheetTabNames(),
    lastSheetSyncAt: syncStats._max.syncedAt?.toISOString() ?? null,
    syncedJobCount,
  });
}
