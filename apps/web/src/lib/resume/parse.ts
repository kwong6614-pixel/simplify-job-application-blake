import OpenAI from "openai";

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

const emptyParsedResume: ParsedResume = {
  workExperiences: [],
  educations: [],
  skills: [],
};

export async function parseResumeText(resumeText: string): Promise<ParsedResume> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return emptyParsedResume;
  }

  const openai = new OpenAI({ apiKey });

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Extract structured resume data for a US job seeker. Return JSON with keys workExperiences, educations, skills, yearsOfExperience, highestEducationLevel. Do not invent data.",
        },
        { role: "user", content: resumeText },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return emptyParsedResume;

    return { ...emptyParsedResume, ...JSON.parse(content) };
  } catch {
    return emptyParsedResume;
  }
}
