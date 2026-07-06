import OpenAI from "openai";
import type { FormField } from "@app/shared";
import type { SheetJob } from "@prisma/client";
import { getOpenAiModel, chatTemperatureOption } from "@/lib/openai-config";
import { resolveSelectAnswer } from "@/lib/fill/select-match";
import { getApplicationFillPrompt } from "@/lib/prompts";
import { profileToUserProfile } from "@/lib/fill/rules";
import type { Profile, WorkExperience, Education, Skill } from "@prisma/client";

type ProfileWithRelations = Profile & {
  workExperiences: WorkExperience[];
  educations: Education[];
  skills: Skill[];
};

function normalizeAiValues(
  fields: FormField[],
  raw: Record<string, string>,
): Record<string, string> {
  const values: Record<string, string> = {};

  for (const field of fields) {
    const answer = raw[field.id]?.trim();
    if (!answer) continue;

    values[field.id] =
      field.type === "select" || field.type === "combobox"
        ? resolveSelectAnswer(field, answer)
        : answer;
  }

  return values;
}

export async function generateAiFillValues(
  apiKey: string,
  userEmail: string,
  profile: ProfileWithRelations,
  job: SheetJob | null,
  fields: FormField[],
): Promise<Record<string, string>> {
  if (fields.length === 0) return {};

  const openai = new OpenAI({ apiKey });
  const systemPrompt = getApplicationFillPrompt();
  const userPayload = {
    profile: profileToUserProfile(userEmail, profile),
    jobDescription: job
      ? {
          company: job.company,
          role: job.role,
          techStack: job.techStack,
          responsibilities: job.responsibilities,
          qualificationsRequired: job.qualificationsRequired,
          qualificationsPreferred: job.qualificationsPreferred,
        }
      : null,
    fields: fields.map((field) => ({
      id: field.id,
      label: field.label,
      type: field.type,
      required: field.required,
      maxLength: field.maxLength,
      options: field.options,
    })),
  };

  const model = getOpenAiModel();
  const response = await openai.chat.completions.create({
    model,
    ...chatTemperatureOption(model, 0.2),
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          "Fill every form field below in one response.",
          "Use the profile for standard application fields (name, contact, address, work authorization, EEO, links, salary, etc.).",
          "Use the job description for role-specific or company-specific questions.",
          "For select/combobox fields, prefer an exact option label or value from the provided options list.",
          'Return JSON only: { "values": { "<fieldId>": "<answer>" } }',
          "",
          JSON.stringify(userPayload),
        ].join("\n"),
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return {};

  try {
    const parsed = JSON.parse(content) as { values?: Record<string, string> };
    return normalizeAiValues(fields, parsed.values ?? {});
  } catch {
    return {};
  }
}
