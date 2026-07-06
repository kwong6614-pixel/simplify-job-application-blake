import type { FormField, UserProfile } from "@app/shared";
import type { Profile, WorkExperience, Education, Skill } from "@prisma/client";
import { resolveSelectAnswer } from "@/lib/fill/select-match";

type ProfileWithRelations = Profile & {
  workExperiences: WorkExperience[];
  educations: Education[];
  skills: Skill[];
};

const LABEL_RULES: Array<{ pattern: RegExp; key: keyof UserProfile | "over18" }> = [
  { pattern: /first[\s_-]?name/i, key: "firstName" },
  { pattern: /last[\s_-]?name|family[\s_-]?name|surname/i, key: "lastName" },
  { pattern: /middle[\s_-]?name/i, key: "middleName" },
  { pattern: /preferred[\s_-]?name/i, key: "preferredName" },
  { pattern: /pronouns?/i, key: "pronouns" },
  { pattern: /e[\s-]?mail/i, key: "email" },
  { pattern: /phone|mobile|telephone/i, key: "phone" },
  { pattern: /address[\s_-]?line[\s_-]?1|street[\s_-]?address|address(?!.*2)/i, key: "addressLine1" },
  { pattern: /address[\s_-]?line[\s_-]?2|apt|suite|unit/i, key: "addressLine2" },
  { pattern: /city|town/i, key: "city" },
  { pattern: /state|province/i, key: "state" },
  { pattern: /zip|postal/i, key: "zip" },
  { pattern: /country/i, key: "country" },
  { pattern: /linkedin/i, key: "linkedinUrl" },
  { pattern: /github/i, key: "githubUrl" },
  { pattern: /portfolio|personal[\s_-]?site|website/i, key: "portfolioUrl" },
  { pattern: /salary|compensation|pay[\s_-]?expect/i, key: "salaryExpectation" },
  { pattern: /how did you hear|where did you find|job source|referral source/i, key: "jobSource" },
  { pattern: /over[\s_-]?18|at least 18|legal age/i, key: "over18" },
  { pattern: /sponsor/i, key: "requiresSponsorship" },
  { pattern: /work[\s_-]?authorization|legally authorized|eligible to work/i, key: "usWorkAuthorization" },
  { pattern: /gender/i, key: "gender" },
  { pattern: /ethnic|race/i, key: "ethnicity" },
  { pattern: /veteran/i, key: "veteranStatus" },
  { pattern: /disabilit/i, key: "disabilityStatus" },
  { pattern: /sexual orientation/i, key: "sexualOrientation" },
  { pattern: /transgender/i, key: "transgenderStatus" },
  { pattern: /relocate/i, key: "willingToRelocate" },
  { pattern: /degree|education level|highest education/i, key: "highestEducationLevel" },
];

function profileToUserProfile(
  userEmail: string,
  profile: ProfileWithRelations,
): UserProfile {
  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    middleName: profile.middleName ?? undefined,
    preferredName: profile.preferredName ?? undefined,
    pronouns: profile.pronouns ?? undefined,
    email: userEmail,
    phone: profile.phone,
    addressLine1: profile.addressLine1,
    addressLine2: profile.addressLine2 ?? undefined,
    city: profile.city,
    state: profile.state,
    zip: profile.zip,
    country: profile.country,
    birthYear: profile.birthYear,
    usWorkAuthorization: profile.usWorkAuthorization as UserProfile["usWorkAuthorization"],
    requiresSponsorship: profile.requiresSponsorship,
    gender: profile.gender as UserProfile["gender"],
    ethnicity: profile.ethnicity,
    veteranStatus: profile.veteranStatus as UserProfile["veteranStatus"],
    disabilityStatus: profile.disabilityStatus as UserProfile["disabilityStatus"],
    sexualOrientation: profile.sexualOrientation,
    transgenderStatus: profile.transgenderStatus as UserProfile["transgenderStatus"],
    salaryExpectation: profile.salaryExpectation,
    salaryPeriod: profile.salaryPeriod as UserProfile["salaryPeriod"],
    jobSource: profile.jobSource,
    linkedinUrl: profile.linkedinUrl ?? undefined,
    githubUrl: profile.githubUrl ?? undefined,
    portfolioUrl: profile.portfolioUrl ?? undefined,
    websiteUrl: profile.websiteUrl ?? undefined,
    willingToRelocate: profile.willingToRelocate,
    remotePreference: profile.remotePreference as UserProfile["remotePreference"],
    earliestStartDate: profile.earliestStartDate ?? undefined,
    yearsOfExperience: profile.yearsOfExperience ?? undefined,
    highestEducationLevel: profile.highestEducationLevel ?? undefined,
    workExperiences: profile.workExperiences.map((item) => ({
      id: item.id,
      company: item.company,
      title: item.title,
      location: item.location ?? undefined,
      startDate: item.startDate,
      endDate: item.endDate ?? undefined,
      isCurrent: item.isCurrent,
      description: item.description ?? undefined,
    })),
    educations: profile.educations.map((item) => ({
      id: item.id,
      school: item.school,
      degree: item.degree,
      fieldOfStudy: item.fieldOfStudy ?? undefined,
      startDate: item.startDate ?? undefined,
      endDate: item.endDate ?? undefined,
      gpa: item.gpa ?? undefined,
    })),
    skills: profile.skills.map((item) => item.name),
  };
}

function formatWorkAuthorization(value: UserProfile["usWorkAuthorization"]): string {
  switch (value) {
    case "us_citizen":
      return "US Citizen";
    case "permanent_resident":
      return "Permanent Resident";
    case "visa_holder":
      return "Visa Holder";
    default:
      return "Other";
  }
}

function formatCountry(value: string): string {
  if (value.toUpperCase() === "US") return "United States";
  return value;
}

function getRuleValue(
  key: keyof UserProfile | "over18",
  profile: UserProfile,
): string {
  if (key === "over18") {
    const age = new Date().getFullYear() - profile.birthYear;
    return age >= 18 ? "Yes" : "No";
  }

  if (key === "usWorkAuthorization") {
    return formatWorkAuthorization(profile.usWorkAuthorization);
  }

  if (key === "country") {
    return formatCountry(profile.country);
  }

  if (key === "highestEducationLevel") {
    return (
      profile.highestEducationLevel ??
      profile.educations[0]?.degree ??
      ""
    );
  }

  const value = profile[key as keyof UserProfile];
  if (value === undefined || value === null) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  return String(value);
}

export function applyRuleBasedFill(
  userEmail: string,
  profile: ProfileWithRelations,
  fields: FormField[],
): { values: Record<string, string>; remaining: FormField[] } {
  const userProfile = profileToUserProfile(userEmail, profile);
  const values: Record<string, string> = {};
  const remaining: FormField[] = [];

  for (const field of fields) {
    const haystack = `${field.label} ${field.id}`.toLowerCase();
    const rule = LABEL_RULES.find(({ pattern }) => pattern.test(haystack));

    if (!rule) {
      remaining.push(field);
      continue;
    }

    const answer = getRuleValue(rule.key, userProfile);
    if (answer) {
      values[field.id] =
        field.type === "select" || field.type === "combobox"
          ? resolveSelectAnswer(field, answer)
          : answer;
    } else {
      remaining.push(field);
    }
  }

  return { values, remaining };
}

export { profileToUserProfile };
