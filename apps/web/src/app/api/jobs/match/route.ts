import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserFromExtensionToken } from "@/lib/auth/extension";
import { prisma } from "@/lib/db";
import { normalizeUrl } from "@/lib/crypto";
import { matchJobByUrl, rememberApplicationUrl } from "@/lib/sheets/google";

async function resolveUserId(request: Request) {
  const session = await auth();
  if (session?.user?.id) return session.user.id;
  const user = await getUserFromExtensionToken(request.headers.get("authorization"));
  return user?.id ?? null;
}

export async function GET(request: Request) {
  const userId = await resolveUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  const syncedJobCount = await prisma.sheetJob.count({ where: { userId } });
  const job = await matchJobByUrl(userId, url);

  if (!job) {
    return NextResponse.json({
      matched: false,
      job: null,
      syncedJobCount,
      hint:
        syncedJobCount === 0
          ? "No sheet jobs synced for this account. Log in on the web app, open Settings, and click Sync sheet tabs."
          : "This URL is not in your synced sheet rows. Confirm column E matches this Greenhouse job, then re-sync.",
    });
  }

  if (normalizeUrl(job.url) !== normalizeUrl(url)) {
    await rememberApplicationUrl(userId, job.id, url);
  }

  return NextResponse.json({
    matched: true,
    job,
    syncedJobCount,
  });
}
