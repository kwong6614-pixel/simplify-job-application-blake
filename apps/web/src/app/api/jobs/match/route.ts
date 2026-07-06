import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserFromExtensionToken } from "@/lib/auth/extension";
import { prisma } from "@/lib/db";
import { normalizeUrl } from "@/lib/crypto";
import { extractAshbyJobUuid, MIN_MATCH_SCORE, scoreUrlMatch } from "@/lib/sheets/url-match";
import { ensureSheetSyncedForUser } from "@/lib/sheets/auto-sync";
import { matchJobByUrl, rememberApplicationUrl } from "@/lib/sheets/google";

export const runtime = "nodejs";
export const maxDuration = 60;

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

  try {
    await ensureSheetSyncedForUser(userId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sheet auto-sync failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const syncedJobCount = await prisma.sheetJob.count({ where: { userId } });
  const job = await matchJobByUrl(userId, url);

  if (!job) {
    const ashbyUuid = extractAshbyJobUuid(url);
    const hint =
      syncedJobCount === 0
        ? "No sheet jobs synced yet. Check Google Sheet env vars on the server."
        : ashbyUuid
          ? `No sheet row matched this Ashby job (${ashbyUuid.slice(0, 8)}…). Force sync on Dashboard and confirm column E contains this Ashby URL (listing or /application both work).`
          : "This URL is not in your synced sheet rows. Confirm column E matches this job posting URL.";

    return NextResponse.json({
      matched: false,
      job: null,
      syncedJobCount,
      hint,
    });
  }

  if (normalizeUrl(job.url) !== normalizeUrl(url) && scoreUrlMatch(job.url, url) >= MIN_MATCH_SCORE) {
    await rememberApplicationUrl(userId, job.id, url);
  }

  return NextResponse.json({
    matched: true,
    job,
    syncedJobCount,
  });
}
