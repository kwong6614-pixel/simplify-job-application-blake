import { NextResponse } from "next/server";
import { getUserFromExtensionToken } from "@/lib/auth/extension";
import { applyRuleBasedFill } from "@/lib/fill/rules";
import { generateAiFillValues } from "@/lib/fill/openai";
import { matchJobByUrl } from "@/lib/sheets/google";
import { fillGenerateSchema } from "@/lib/validators";

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

  const apiKey = user.profile.openaiApiKeyEnc ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OpenAI API key is not configured in settings" },
      { status: 400 },
    );
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
