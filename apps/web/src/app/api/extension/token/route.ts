import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { createExtensionToken } from "@/lib/crypto";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tokenCount = await prisma.extensionToken.count({
    where: {
      userId: session.user.id,
      expiresAt: { gt: new Date() },
    },
  });

  return NextResponse.json({
    connected: tokenCount > 0,
  });
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { token, tokenHash } = createExtensionToken();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 90);

  await prisma.extensionToken.create({
    data: {
      userId: session.user.id,
      tokenHash,
      label: "Chrome extension",
      expiresAt,
    },
  });

  return NextResponse.json({ token, expiresAt });
}
