import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isGoogleSheetEnvConfigured } from "@/lib/sheets/config";
import { z } from "zod";

const settingsSchema = z.object({
  openaiApiKey: z.string().min(10),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.profile.findUnique({ where: { userId: session.user.id } });

  return NextResponse.json({
    hasOpenAiKey: Boolean(profile?.openaiApiKeyEnc),
    sheetConfigured: isGoogleSheetEnvConfigured(),
    spreadsheetId: process.env.GOOGLE_SHEETS_ID ?? null,
    sheetTabName: process.env.GOOGLE_SHEET_TAB_NAME ?? "For Resume",
  });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid settings" }, { status: 400 });
  }

  await prisma.profile.update({
    where: { userId: session.user.id },
    data: { openaiApiKeyEnc: parsed.data.openaiApiKey },
  });

  return NextResponse.json({ ok: true });
}
