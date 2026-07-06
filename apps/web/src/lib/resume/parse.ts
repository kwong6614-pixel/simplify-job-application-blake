import OpenAI from "openai";
import { getOpenAiModel } from "@/lib/openai-config";

export interface ParsedResume {
  workExperiences: Array<{
    company: string;
    title: string;
    location?: string;
    startDate: string;
    endDate?: string;
    isCurrent: boolean;
    description?: string;
  }>;
  educations: Array<{
    school: string;
    degree: string;
    fieldOfStudy?: string;
    startDate?: string;
    endDate?: string;
    gpa?: string;
  }>;
  skills: string[];
  yearsOfExperience?: number;
  highestEducationLevel?: string;
}

export type ParseResumeResult = {
  data: ParsedResume;
  openaiConfigured: boolean;
  model: string;
  extractedCharacters: number;
  error?: string;
};

const emptyParsedResume: ParsedResume = {
  workExperiences: [],
  educations: [],
  skills: [],
};

export function isOpenAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeParsedResume(raw: unknown): ParsedResume {
  const record = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const workExperiences = Array.isArray(record.workExperiences)
    ? record.workExperiences
        .map((item) => {
          const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
          const company = asString(row.company);
          const title = asString(row.title);
          const startDate = asString(row.startDate);
          if (!company || !title || !startDate) return null;
          return {
            company,
            title,
            location: asString(row.location) || undefined,
            startDate,
            endDate: asString(row.endDate) || undefined,
            isCurrent: Boolean(row.isCurrent),
            description: asString(row.description) || undefined,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
    : [];

  const educations = Array.isArray(record.educations)
    ? record.educations
        .map((item) => {
          const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
          const school = asString(row.school);
          const degree = asString(row.degree);
          if (!school || !degree) return null;
          return {
            school,
            degree,
            fieldOfStudy: asString(row.fieldOfStudy) || undefined,
            startDate: asString(row.startDate) || undefined,
            endDate: asString(row.endDate) || undefined,
            gpa: asString(row.gpa) || undefined,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
    : [];

  const skills = Array.isArray(record.skills)
    ? record.skills.map((item) => asString(item)).filter(Boolean)
    : [];

  const yearsRaw = record.yearsOfExperience;
  const yearsOfExperience =
    typeof yearsRaw === "number"
      ? yearsRaw
      : typeof yearsRaw === "string" && yearsRaw.trim()
        ? Number.parseInt(yearsRaw, 10)
        : undefined;

  const highestEducationLevel = asString(record.highestEducationLevel) || undefined;

  return {
    workExperiences,
    educations,
    skills,
    yearsOfExperience: Number.isFinite(yearsOfExperience) ? yearsOfExperience : undefined,
    highestEducationLevel,
  };
}

export async function parseResumeText(resumeText: string): Promise<ParseResumeResult> {
  const extractedCharacters = resumeText.trim().length;
  const model = getOpenAiModel();
  const openaiConfigured = isOpenAiConfigured();

  if (!openaiConfigured) {
    return {
      data: emptyParsedResume,
      openaiConfigured: false,
      model,
      extractedCharacters,
      error:
        "OpenAI is not configured on the server. Add OPENAI_API_KEY to .env.local (local) or Vercel environment variables (production), then restart or redeploy.",
    };
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const response = await openai.chat.completions.create({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Extract structured resume data for a US job seeker. Return JSON with keys workExperiences (array of {company,title,location,startDate,endDate,isCurrent,description}), educations (array of {school,degree,fieldOfStudy,startDate,endDate,gpa}), skills (string array), yearsOfExperience (number), highestEducationLevel (string). Use only information present in the resume. Do not invent data.",
        },
        { role: "user", content: resumeText.slice(0, 120_000) },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return {
        data: emptyParsedResume,
        openaiConfigured: true,
        model,
        extractedCharacters,
        error: "OpenAI returned an empty response. Try again or edit your profile manually below.",
      };
    }

    return {
      data: normalizeParsedResume(JSON.parse(content)),
      openaiConfigured: true,
      model,
      extractedCharacters,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "OpenAI could not parse this resume. Try again or edit fields manually.";

    return {
      data: emptyParsedResume,
      openaiConfigured: true,
      model,
      extractedCharacters,
      error: message,
    };
  }
}

export function countParsedItems(data: ParsedResume): number {
  return data.workExperiences.length + data.educations.length + data.skills.length;
}
