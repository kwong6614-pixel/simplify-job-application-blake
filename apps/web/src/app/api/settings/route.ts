import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isGoogleSheetEnvConfigured, getSheetTabNames } from "@/lib/sheets/config";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
    sheetConfigured: isGoogleSheetEnvConfigured(),
    spreadsheetId: process.env.GOOGLE_SHEETS_ID ?? null,
    sheetTabNames: getSheetTabNames(),
  });
}
