import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserFromExtensionToken } from "@/lib/auth/extension";
import { ensureSheetSyncedForUser } from "@/lib/sheets/auto-sync";

export const runtime = "nodejs";
export const maxDuration = 60;

async function resolveUserId(request: Request) {
  const session = await auth();
  if (session?.user?.id) return session.user.id;
  const user = await getUserFromExtensionToken(request.headers.get("authorization"));
  return user?.id ?? null;
}

export async function POST(request: Request) {
  const userId = await resolveUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await ensureSheetSyncedForUser(userId, { force: true });
    if (result.skipped && result.reason === "not_configured") {
      return NextResponse.json(
        { error: "Google Sheet env vars are not configured on the server." },
        { status: 400 },
      );
    }
    return NextResponse.json({
      synced: result.synced ?? 0,
      tabs: result.tabs ?? {},
      lastSheetSyncAt: result.lastSheetSyncAt ?? null,
      auto: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
