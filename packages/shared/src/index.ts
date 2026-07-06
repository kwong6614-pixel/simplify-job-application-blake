export type UsWorkAuthorization =
  | "us_citizen"
  | "permanent_resident"
  | "visa_holder"
  | "other";

export type RemotePreference = "remote" | "hybrid" | "onsite" | "no_preference";

export type Gender =
  | "male"
  | "female"
  | "non_binary"
  | "prefer_not_to_say"
  | "self_describe";

export type EeoChoice = "yes" | "no" | "prefer_not_to_say";

export interface WorkExperience {
  id?: string;
  company: string;
  title: string;
  location?: string;
  startDate: string;
  endDate?: string;
  isCurrent: boolean;
  description?: string;
}

export interface Education {
  id?: string;
  school: string;
  degree: string;
  fieldOfStudy?: string;
  startDate?: string;
  endDate?: string;
  gpa?: string;
}

export interface UserProfile {
  firstName: string;
  lastName: string;
  middleName?: string;
  preferredName?: string;
  pronouns?: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  birthYear: number;
  usWorkAuthorization: UsWorkAuthorization;
  requiresSponsorship: boolean;
  gender: Gender;
  ethnicity: string;
  veteranStatus: EeoChoice;
  disabilityStatus: EeoChoice;
  sexualOrientation: string;
  transgenderStatus: EeoChoice;
  salaryExpectation: number;
  salaryPeriod: "annual" | "hourly";
  jobSource: string;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  websiteUrl?: string;
  willingToRelocate: boolean;
  remotePreference: RemotePreference;
  earliestStartDate?: string;
  yearsOfExperience?: number;
  highestEducationLevel?: string;
  workExperiences: WorkExperience[];
  educations: Education[];
  skills: string[];
}

export interface SheetJobRow {
  id: string;
  date?: string;
  company: string;
  role: string;
  techStack?: string;
  url: string;
  responsibilities: string;
  qualificationsRequired: string;
  qualificationsPreferred: string;
  submittedBy?: string;
}

export interface FormFieldOption {
  value: string;
  label: string;
}

export type FormFieldType =
  | "text"
  | "textarea"
  | "email"
  | "tel"
  | "number"
  | "url"
  | "select"
  | "combobox";

export interface FormField {
  id: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  maxLength?: number;
  currentValue?: string;
  options?: FormFieldOption[];
}

export interface TabFormSnapshot {
  tabId: number;
  url: string;
  title: string;
  atsPlatform: string;
  fields: FormField[];
}

export interface FillGenerateRequest {
  url: string;
  fields: FormField[];
}

export interface FillGenerateResponse {
  values: Record<string, string>;
  unmatchedFieldIds: string[];
}

export const SHEET_TAB_NAME = "For Resume";

export const SHEET_COLUMNS = {
  date: "A",
  company: "B",
  role: "C",
  techStack: "D",
  url: "E",
  responsibilities: "F",
  qualificationsRequired: "G",
  qualificationsPreferred: "H",
  tokenUsage: "I",
  submittedBy: "J",
} as const;

export const ATS_PLATFORMS = [
  "greenhouse",
  "lever",
  "ashby",
  "workday",
  "workforcenow",
  "paylocity",
  "gusto",
  "dover",
  "icims",
  "rippling",
  "gem",
  "recruiterflow",
  "smartrecruiters",
  "workable",
  "jobvite",
  "generic",
] as const;

export type AtsPlatform = (typeof ATS_PLATFORMS)[number];
