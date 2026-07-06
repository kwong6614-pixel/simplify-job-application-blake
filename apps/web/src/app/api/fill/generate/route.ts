import { NextResponse } from "next/server";
import { getUserFromExtensionToken } from "@/lib/auth/extension";
import { applyRuleBasedFill } from "@/lib/fill/rules";
import { generateAiFillValues } from "@/lib/fill/openai";
import { ensureSheetSyncedForUser } from "@/lib/sheets/auto-sync";
import { matchJobByUrl } from "@/lib/sheets/google";
import { fillGenerateSchema } from "@/lib/validators";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const user = await getUserFromExtensionToken(request.headers.get("authorization"));
  if (!user?.profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = fillGenerateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OpenAI API key is not configured. Set OPENAI_API_KEY in environment variables." },
      { status: 400 },
    );
  }

  try {
    await ensureSheetSyncedForUser(user.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sheet auto-sync failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const job = await matchJobByUrl(user.id, parsed.data.url);
  const { values: ruleValues, remaining } = applyRuleBasedFill(
    user.email,
    user.profile,
    parsed.data.fields,
  );

  const aiValues = await generateAiFillValues(
    apiKey,
    user.email,
    user.profile,
    job,
    remaining,
  );

  const values = { ...ruleValues, ...aiValues };
  const unmatchedFieldIds = parsed.data.fields
    .filter((field) => !values[field.id]?.trim())
    .map((field) => field.id);

  return NextResponse.json({ values, unmatchedFieldIds });
}
