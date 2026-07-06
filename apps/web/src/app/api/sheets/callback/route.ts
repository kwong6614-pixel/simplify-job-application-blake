import { NextResponse } from "next/server";
import { exchangeGoogleCode } from "@/lib/sheets/google";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(new URL("/settings?error=oauth", request.url));
  }

  const tokens = await exchangeGoogleCode(code);
  if (!tokens.access_token || !tokens.refresh_token) {
    return NextResponse.redirect(new URL("/settings?error=oauth", request.url));
  }

  await prisma.googleSheetAccount.upsert({
    where: { userId: state },
    create: {
      userId: state,
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

  return NextResponse.redirect(new URL("/settings?connected=1", request.url));
}
