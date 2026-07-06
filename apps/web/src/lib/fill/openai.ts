import OpenAI from "openai";
import type { FormField } from "@app/shared";
import type { SheetJob } from "@prisma/client";
import { getApplicationFillPrompt } from "@/lib/prompts";
import { profileToUserProfile } from "@/lib/fill/rules";
import type { Profile, WorkExperience, Education, Skill } from "@prisma/client";

type ProfileWithRelations = Profile & {
  workExperiences: WorkExperience[];
  educations: Education[];
  skills: Skill[];
};

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

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Fill the following form fields. Return JSON with shape { "values": { "<fieldId>": "<answer>" } }.\n\n${JSON.stringify(userPayload)}`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return {};

  try {
    const parsed = JSON.parse(content) as { values?: Record<string, string> };
    return parsed.values ?? {};
  } catch {
    return {};
  }
}
