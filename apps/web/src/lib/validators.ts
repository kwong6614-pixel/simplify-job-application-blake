import { z } from "zod";

const signupFieldsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  middleName: z.string().optional(),
  preferredName: z.string().optional(),
  pronouns: z.string().optional(),
  phone: z.string().min(7),
  addressLine1: z.string().min(1),
  addressLine2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(2),
  zip: z.string().min(5),
  country: z.string().default("US"),
  birthYear: z.coerce.number().int().min(1940).max(new Date().getFullYear() - 16),
  usWorkAuthorization: z.enum([
    "us_citizen",
    "permanent_resident",
    "visa_holder",
    "other",
  ]),
  requiresSponsorship: z.preprocess(
    (value) => value === "yes" || value === true,
    z.boolean(),
  ),
  gender: z.string().min(1),
  ethnicity: z.string().min(1),
  veteranStatus: z.enum(["yes", "no", "prefer_not_to_say"]),
  disabilityStatus: z.enum(["yes", "no", "prefer_not_to_say"]),
  sexualOrientation: z.string().min(1),
  transgenderStatus: z.enum(["yes", "no", "prefer_not_to_say"]),
  salaryExpectation: z.coerce.number().int().positive(),
  salaryPeriod: z.enum(["annual", "hourly"]).default("annual"),
  jobSource: z.string().min(1),
  linkedinUrl: z.string().url().optional().or(z.literal("")),
  githubUrl: z.string().url().optional().or(z.literal("")),
  portfolioUrl: z.string().url().optional().or(z.literal("")),
  websiteUrl: z.string().url().optional().or(z.literal("")),
  willingToRelocate: z
    .preprocess((value) => value === "yes" || value === true, z.boolean())
    .default(false),
  remotePreference: z
    .enum(["remote", "hybrid", "onsite", "no_preference"])
    .default("no_preference"),
  earliestStartDate: z.string().optional(),
  yearsOfExperience: z.coerce.number().int().optional(),
  highestEducationLevel: z.string().optional(),
  workExperiences: z
    .array(
      z.object({
        company: z.string().min(1),
        title: z.string().min(1),
        location: z.string().optional(),
        startDate: z.string().min(1),
        endDate: z.string().optional(),
        isCurrent: z.boolean(),
        description: z.string().optional(),
      }),
    )
    .default([]),
  educations: z
    .array(
      z.object({
        school: z.string().min(1),
        degree: z.string().min(1),
        fieldOfStudy: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        gpa: z.string().optional(),
      }),
    )
    .default([]),
  skills: z.array(z.string()).default([]),
});

export const signupSchema = signupFieldsSchema.extend({
  resumeText: z.string().min(50, "Resume text is required for signup parsing"),
});

export function parseSignupFormData(formData: FormData) {
  const raw = Object.fromEntries(
    Array.from(formData.entries()).filter(([, value]) => typeof value === "string"),
  ) as Record<string, string>;

  return signupFieldsSchema.safeParse(raw);
}

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(32),
  password: z.string().min(8),
});

export const fillGenerateSchema = z.object({
  url: z.string().url(),
  fields: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      type: z.enum(["text", "textarea", "email", "tel", "number", "url", "select", "combobox"]),
      required: z.boolean(),
      maxLength: z.number().optional(),
      currentValue: z.string().optional(),
      options: z
        .array(
          z.object({
            value: z.string(),
            label: z.string(),
          }),
        )
        .optional(),
    }),
  ),
});
