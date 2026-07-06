import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const settingsSchema = z.object({
  openaiApiKey: z.string().min(10),
  spreadsheetId: z.string().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [profile, sheetAccount] = await Promise.all([
    prisma.profile.findUnique({ where: { userId: session.user.id } }),
    prisma.googleSheetAccount.findUnique({ where: { userId: session.user.id } }),
  ]);

  return NextResponse.json({
    hasOpenAiKey: Boolean(profile?.openaiApiKeyEnc),
    sheetConnected: Boolean(sheetAccount),
    spreadsheetId: sheetAccount?.spreadsheetId ?? null,
    lastSyncedAt: sheetAccount?.lastSyncedAt ?? null,
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

  if (parsed.data.spreadsheetId) {
    await prisma.googleSheetAccount.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        accessToken: "",
        refreshToken: "",
        expiresAt: new Date(0),
        spreadsheetId: parsed.data.spreadsheetId,
      },
      update: { spreadsheetId: parsed.data.spreadsheetId },
    });
  }

  return NextResponse.json({ ok: true });
}
