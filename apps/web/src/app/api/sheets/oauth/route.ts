import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getGoogleAuthUrl, exchangeGoogleCode } from "@/lib/sheets/google";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = getGoogleAuthUrl(session.user.id);
  return NextResponse.json({ url });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  const tokens = await exchangeGoogleCode(code);
  if (!tokens.access_token || !tokens.refresh_token) {
    return NextResponse.json({ error: "Google OAuth failed" }, { status: 400 });
  }

  await prisma.googleSheetAccount.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(tokens.expiry_date ?? Date.now() + 3600_000),
    },
    update: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(tokens.expiry_date ?? Date.now() + 3600_000),
    },
  });

  return NextResponse.json({ ok: true });
}
