"use client";

import { useRef, useState, type ReactNode } from "react";
import type { ProfileUpdateInput } from "@/lib/validators";

const inputClass = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm";

type ResumeMeta = {
  resumeFileName: string | null;
  resumeParsedAt: string | null;
};

export type DashboardProfileInitial = ProfileUpdateInput & ResumeMeta;

type DashboardProfileProps = {
  email: string;
  openaiConfigured: boolean;
  openaiModel: string;
  initialProfile: DashboardProfileInitial;
};

type ResumeFeedback = {
  level: "success" | "warning" | "error";
  message: string;
} | null;

const emptyWork = (): ProfileUpdateInput["workExperiences"][number] => ({
  company: "",
  title: "",
  location: "",
  startDate: "",
  endDate: "",
  isCurrent: false,
  description: "",
});

const emptyEducation = (): ProfileUpdateInput["educations"][number] => ({
  school: "",
  degree: "",
  fieldOfStudy: "",
  startDate: "",
  endDate: "",
  gpa: "",
});

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block text-sm ${className}`}>
      {label}
      {children}
    </label>
  );
}

export default function DashboardProfile({
  email,
  openaiConfigured,
  openaiModel,
  initialProfile,
}: DashboardProfileProps) {
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<ProfileUpdateInput>({
    firstName: initialProfile.firstName,
    lastName: initialProfile.lastName,
    middleName: initialProfile.middleName ?? "",
    preferredName: initialProfile.preferredName ?? "",
    pronouns: initialProfile.pronouns ?? "",
    phone: initialProfile.phone,
    addressLine1: initialProfile.addressLine1,
    addressLine2: initialProfile.addressLine2 ?? "",
    city: initialProfile.city,
    state: initialProfile.state,
    zip: initialProfile.zip,
    country: initialProfile.country,
    birthYear: initialProfile.birthYear,
    usWorkAuthorization: initialProfile.usWorkAuthorization,
    requiresSponsorship: initialProfile.requiresSponsorship,
    gender: initialProfile.gender,
    ethnicity: initialProfile.ethnicity,
    veteranStatus: initialProfile.veteranStatus,
    disabilityStatus: initialProfile.disabilityStatus,
    sexualOrientation: initialProfile.sexualOrientation,
    transgenderStatus: initialProfile.transgenderStatus,
    salaryExpectation: initialProfile.salaryExpectation,
    salaryPeriod: initialProfile.salaryPeriod,
    jobSource: initialProfile.jobSource,
    linkedinUrl: initialProfile.linkedinUrl ?? "",
    githubUrl: initialProfile.githubUrl ?? "",
    portfolioUrl: initialProfile.portfolioUrl ?? "",
    websiteUrl: initialProfile.websiteUrl ?? "",
    willingToRelocate: initialProfile.willingToRelocate,
    remotePreference: initialProfile.remotePreference,
    earliestStartDate: initialProfile.earliestStartDate ?? "",
    yearsOfExperience: initialProfile.yearsOfExperience,
    highestEducationLevel: initialProfile.highestEducationLevel ?? "",
    workExperiences:
      initialProfile.workExperiences.length > 0
        ? initialProfile.workExperiences
        : [emptyWork()],
    educations: initialProfile.educations.length > 0 ? initialProfile.educations : [emptyEducation()],
    skills: initialProfile.skills,
  });

  const [resumeFileName, setResumeFileName] = useState(initialProfile.resumeFileName);
  const [resumeParsedAt, setResumeParsedAt] = useState(initialProfile.resumeParsedAt);
  const [skillsText, setSkillsText] = useState(initialProfile.skills.join(", "));
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resumeFeedback, setResumeFeedback] = useState<ResumeFeedback>(null);
  const [parsingStep, setParsingStep] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [parsing, setParsing] = useState(false);

  function updateField<K extends keyof ProfileUpdateInput>(key: K, value: ProfileUpdateInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function saveProfile() {
    setSaving(true);
    setError(null);
    setStatus("Saving profile...");

    const payload: ProfileUpdateInput = {
      ...form,
      skills: skillsText
        .split(/[,;\n]/)
        .map((s) => s.trim())
        .filter(Boolean),
      workExperiences: form.workExperiences.filter((w) => w.company.trim() && w.title.trim()),
      educations: form.educations.filter((e) => e.school.trim() && e.degree.trim()),
      linkedinUrl: form.linkedinUrl || "",
      githubUrl: form.githubUrl || "",
      portfolioUrl: form.portfolioUrl || "",
      websiteUrl: form.websiteUrl || "",
    };

    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    setSaving(false);

    if (!response.ok) {
      setError(data.error ?? "Failed to save profile");
      setStatus(null);
      return;
    }

    if (data.profile) {
      const work = (data.profile.workExperiences ?? []).map(
        (item: {
          company: string;
          title: string;
          location?: string | null;
          startDate: string;
          endDate?: string | null;
          isCurrent: boolean;
          description?: string | null;
        }) => ({
          company: item.company,
          title: item.title,
          location: item.location ?? "",
          startDate: item.startDate,
          endDate: item.endDate ?? "",
          isCurrent: item.isCurrent,
          description: item.description ?? "",
        }),
      );
      const edu = (data.profile.educations ?? []).map(
        (item: {
          school: string;
          degree: string;
          fieldOfStudy?: string | null;
          startDate?: string | null;
          endDate?: string | null;
          gpa?: string | null;
        }) => ({
          school: item.school,
          degree: item.degree,
          fieldOfStudy: item.fieldOfStudy ?? "",
          startDate: item.startDate ?? "",
          endDate: item.endDate ?? "",
          gpa: item.gpa ?? "",
        }),
      );
      const skillNames = (data.profile.skills ?? []).map((s: { name: string }) => s.name);

      setForm({
        ...payload,
        workExperiences: work.length > 0 ? work : [emptyWork()],
        educations: edu.length > 0 ? edu : [emptyEducation()],
        skills: skillNames,
      });
      setSkillsText(skillNames.join(", "));
    }

    setStatus("Profile saved.");
  }

  async function reparseResume(file: File) {
    setParsing(true);
    setError(null);
    setResumeFeedback(null);
    setParsingStep("Reading PDF text...");

    const body = new FormData();
    body.append("resume", file);

    try {
      setParsingStep("Sending to server for AI extraction...");
      const response = await fetch("/api/profile/resume", { method: "POST", body });
      const data = await response.json();

      if (!response.ok) {
        setResumeFeedback({
          level: "error",
          message: data.error ?? "Resume upload failed.",
        });
        return;
      }

      setResumeFileName(data.parsed.resumeFileName);
      setResumeParsedAt(data.parsed.resumeParsedAt);

      if (data.updated && data.profile) {
        applyProfileFromServer(data.profile);
      }

      setResumeFeedback({
        level: data.level === "warning" ? "warning" : "success",
        message: data.message ?? "Resume processed.",
      });
    } catch {
      setResumeFeedback({
        level: "error",
        message: "Network error while uploading. Check your connection and try again.",
      });
    } finally {
      setParsing(false);
      setParsingStep(null);
      if (resumeInputRef.current) {
        resumeInputRef.current.value = "";
      }
    }
  }

  function applyProfileFromServer(profile: {
    yearsOfExperience?: number | null;
    highestEducationLevel?: string | null;
    workExperiences?: Array<{
      company: string;
      title: string;
      location?: string | null;
      startDate: string;
      endDate?: string | null;
      isCurrent: boolean;
      description?: string | null;
    }>;
    educations?: Array<{
      school: string;
      degree: string;
      fieldOfStudy?: string | null;
      startDate?: string | null;
      endDate?: string | null;
      gpa?: string | null;
    }>;
    skills?: Array<{ name: string }>;
  }) {
    const work = (profile.workExperiences ?? []).map((item) => ({
      company: item.company,
      title: item.title,
      location: item.location ?? "",
      startDate: item.startDate,
      endDate: item.endDate ?? "",
      isCurrent: item.isCurrent,
      description: item.description ?? "",
    }));
    const edu = (profile.educations ?? []).map((item) => ({
      school: item.school,
      degree: item.degree,
      fieldOfStudy: item.fieldOfStudy ?? "",
      startDate: item.startDate ?? "",
      endDate: item.endDate ?? "",
      gpa: item.gpa ?? "",
    }));
    const skillNames = (profile.skills ?? []).map((s) => s.name);

    setForm((prev) => ({
      ...prev,
      yearsOfExperience: profile.yearsOfExperience ?? prev.yearsOfExperience,
      highestEducationLevel: profile.highestEducationLevel ?? prev.highestEducationLevel,
      workExperiences: work.length > 0 ? work : [emptyWork()],
      educations: edu.length > 0 ? edu : [emptyEducation()],
      skills: skillNames,
    }));
    setSkillsText(skillNames.join(", "));
  }

  const parseStatus = resumeParsedAt
    ? `Parsed on ${new Date(resumeParsedAt).toLocaleString()}`
    : "Not parsed yet";

  return (
    <div className="mt-6 space-y-6">
      <section className="rounded-xl border bg-white p-6">
        <h2 className="font-medium">Resume PDF</h2>
        <p className="mt-2 text-sm text-slate-600">
          Upload a text-based PDF resume. We extract work history, education, and skills with AI,
          then show the results in the sections below.
        </p>

        <div
          className={`mt-4 rounded-md p-3 text-sm ${
            openaiConfigured
              ? "bg-green-50 text-green-900"
              : "bg-amber-50 text-amber-900"
          }`}
        >
          {openaiConfigured
            ? `AI parsing is ready on the server (model: ${openaiModel}).`
            : "AI parsing is off — add OPENAI_API_KEY to the server environment (.env.local locally, Vercel env vars in production), then restart or redeploy."}
        </div>

        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Current file</dt>
            <dd className="font-medium">{resumeFileName ?? "None uploaded yet"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Last parsed</dt>
            <dd className="font-medium">{parseStatus}</dd>
          </div>
          <div>
            <dt className="text-slate-500">In your profile now</dt>
            <dd className="font-medium">
              {form.workExperiences.filter((w) => w.company).length} roles,{" "}
              {form.educations.filter((e) => e.school).length} schools,{" "}
              {skillsText.split(/[,;\n]/).filter((s) => s.trim()).length} skills
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Account</dt>
            <dd className="font-medium">{email}</dd>
          </div>
        </dl>

        {parsing && parsingStep ? (
          <p className="mt-4 text-sm text-indigo-700">{parsingStep}</p>
        ) : null}

        {resumeFeedback ? (
          <p
            className={`mt-4 rounded-md p-3 text-sm ${
              resumeFeedback.level === "success"
                ? "bg-green-50 text-green-900"
                : resumeFeedback.level === "warning"
                  ? "bg-amber-50 text-amber-900"
                  : "bg-red-50 text-red-900"
            }`}
          >
            {resumeFeedback.message}
          </p>
        ) : null}

        <label className="mt-4 block text-sm">
          Upload resume PDF
          <input
            ref={resumeInputRef}
            type="file"
            accept="application/pdf,.pdf"
            disabled={parsing || !openaiConfigured}
            className={`${inputClass} file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-indigo-700 disabled:opacity-60`}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void reparseResume(file);
            }}
          />
        </label>
        {!openaiConfigured ? (
          <p className="mt-2 text-xs text-slate-500">
            Upload is disabled until OpenAI is configured on the server.
          </p>
        ) : (
          <p className="mt-2 text-xs text-slate-500">
            Tip: scanned/image PDFs often fail. Export from Word or Google Docs as PDF for best
            results.
          </p>
        )}
      </section>

      <section className="rounded-xl border bg-white p-6">
        <h2 className="font-medium">Personal</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="First name">
            <input
              className={inputClass}
              value={form.firstName}
              onChange={(e) => updateField("firstName", e.target.value)}
            />
          </Field>
          <Field label="Last name">
            <input
              className={inputClass}
              value={form.lastName}
              onChange={(e) => updateField("lastName", e.target.value)}
            />
          </Field>
          <Field label="Middle name">
            <input
              className={inputClass}
              value={form.middleName ?? ""}
              onChange={(e) => updateField("middleName", e.target.value)}
            />
          </Field>
          <Field label="Preferred name">
            <input
              className={inputClass}
              value={form.preferredName ?? ""}
              onChange={(e) => updateField("preferredName", e.target.value)}
            />
          </Field>
          <Field label="Pronouns">
            <input
              className={inputClass}
              value={form.pronouns ?? ""}
              onChange={(e) => updateField("pronouns", e.target.value)}
            />
          </Field>
          <Field label="Phone">
            <input
              className={inputClass}
              value={form.phone}
              onChange={(e) => updateField("phone", e.target.value)}
            />
          </Field>
          <Field label="Birth year">
            <input
              type="number"
              className={inputClass}
              value={form.birthYear}
              onChange={(e) => updateField("birthYear", Number(e.target.value))}
            />
          </Field>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-6">
        <h2 className="font-medium">Address</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Address line 1" className="md:col-span-2">
            <input
              className={inputClass}
              value={form.addressLine1}
              onChange={(e) => updateField("addressLine1", e.target.value)}
            />
          </Field>
          <Field label="Address line 2" className="md:col-span-2">
            <input
              className={inputClass}
              value={form.addressLine2 ?? ""}
              onChange={(e) => updateField("addressLine2", e.target.value)}
            />
          </Field>
          <Field label="City">
            <input
              className={inputClass}
              value={form.city}
              onChange={(e) => updateField("city", e.target.value)}
            />
          </Field>
          <Field label="State">
            <input
              className={inputClass}
              value={form.state}
              onChange={(e) => updateField("state", e.target.value)}
            />
          </Field>
          <Field label="ZIP">
            <input
              className={inputClass}
              value={form.zip}
              onChange={(e) => updateField("zip", e.target.value)}
            />
          </Field>
          <Field label="Country">
            <input
              className={inputClass}
              value={form.country}
              onChange={(e) => updateField("country", e.target.value)}
            />
          </Field>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-6">
        <h2 className="font-medium">Work authorization & EEO</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="US work authorization">
            <select
              className={inputClass}
              value={form.usWorkAuthorization}
              onChange={(e) =>
                updateField(
                  "usWorkAuthorization",
                  e.target.value as ProfileUpdateInput["usWorkAuthorization"],
                )
              }
            >
              <option value="us_citizen">US citizen</option>
              <option value="permanent_resident">Permanent resident</option>
              <option value="visa_holder">Visa holder</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="Requires sponsorship">
            <select
              className={inputClass}
              value={form.requiresSponsorship ? "yes" : "no"}
              onChange={(e) => updateField("requiresSponsorship", e.target.value === "yes")}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </Field>
          <Field label="Gender">
            <input
              className={inputClass}
              value={form.gender}
              onChange={(e) => updateField("gender", e.target.value)}
            />
          </Field>
          <Field label="Ethnicity">
            <input
              className={inputClass}
              value={form.ethnicity}
              onChange={(e) => updateField("ethnicity", e.target.value)}
            />
          </Field>
          <Field label="Veteran status">
            <select
              className={inputClass}
              value={form.veteranStatus}
              onChange={(e) =>
                updateField("veteranStatus", e.target.value as ProfileUpdateInput["veteranStatus"])
              }
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </Field>
          <Field label="Disability status">
            <select
              className={inputClass}
              value={form.disabilityStatus}
              onChange={(e) =>
                updateField(
                  "disabilityStatus",
                  e.target.value as ProfileUpdateInput["disabilityStatus"],
                )
              }
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </Field>
          <Field label="Sexual orientation">
            <input
              className={inputClass}
              value={form.sexualOrientation}
              onChange={(e) => updateField("sexualOrientation", e.target.value)}
            />
          </Field>
          <Field label="Transgender status">
            <select
              className={inputClass}
              value={form.transgenderStatus}
              onChange={(e) =>
                updateField(
                  "transgenderStatus",
                  e.target.value as ProfileUpdateInput["transgenderStatus"],
                )
              }
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </Field>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-6">
        <h2 className="font-medium">Application defaults</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Salary expectation">
            <input
              type="number"
              className={inputClass}
              value={form.salaryExpectation}
              onChange={(e) => updateField("salaryExpectation", Number(e.target.value))}
            />
          </Field>
          <Field label="Salary period">
            <select
              className={inputClass}
              value={form.salaryPeriod}
              onChange={(e) =>
                updateField("salaryPeriod", e.target.value as ProfileUpdateInput["salaryPeriod"])
              }
            >
              <option value="annual">Annual</option>
              <option value="hourly">Hourly</option>
            </select>
          </Field>
          <Field label="Job source">
            <input
              className={inputClass}
              value={form.jobSource}
              onChange={(e) => updateField("jobSource", e.target.value)}
            />
          </Field>
          <Field label="Years of experience">
            <input
              type="number"
              className={inputClass}
              value={form.yearsOfExperience ?? ""}
              onChange={(e) =>
                updateField(
                  "yearsOfExperience",
                  e.target.value ? Number(e.target.value) : undefined,
                )
              }
            />
          </Field>
          <Field label="Highest education level">
            <input
              className={inputClass}
              value={form.highestEducationLevel ?? ""}
              onChange={(e) => updateField("highestEducationLevel", e.target.value)}
            />
          </Field>
          <Field label="Earliest start date">
            <input
              className={inputClass}
              value={form.earliestStartDate ?? ""}
              onChange={(e) => updateField("earliestStartDate", e.target.value)}
            />
          </Field>
          <Field label="Willing to relocate">
            <select
              className={inputClass}
              value={form.willingToRelocate ? "yes" : "no"}
              onChange={(e) => updateField("willingToRelocate", e.target.value === "yes")}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </Field>
          <Field label="Remote preference">
            <select
              className={inputClass}
              value={form.remotePreference}
              onChange={(e) =>
                updateField(
                  "remotePreference",
                  e.target.value as ProfileUpdateInput["remotePreference"],
                )
              }
            >
              <option value="no_preference">No preference</option>
              <option value="remote">Remote</option>
              <option value="hybrid">Hybrid</option>
              <option value="onsite">On-site</option>
            </select>
          </Field>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-6">
        <h2 className="font-medium">Links</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="LinkedIn URL">
            <input
              className={inputClass}
              value={form.linkedinUrl ?? ""}
              onChange={(e) => updateField("linkedinUrl", e.target.value)}
            />
          </Field>
          <Field label="GitHub URL">
            <input
              className={inputClass}
              value={form.githubUrl ?? ""}
              onChange={(e) => updateField("githubUrl", e.target.value)}
            />
          </Field>
          <Field label="Portfolio URL">
            <input
              className={inputClass}
              value={form.portfolioUrl ?? ""}
              onChange={(e) => updateField("portfolioUrl", e.target.value)}
            />
          </Field>
          <Field label="Website URL">
            <input
              className={inputClass}
              value={form.websiteUrl ?? ""}
              onChange={(e) => updateField("websiteUrl", e.target.value)}
            />
          </Field>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Work experience (from PDF or manual)</h2>
          <button
            type="button"
            className="text-sm text-indigo-600 hover:underline"
            onClick={() =>
              updateField("workExperiences", [...form.workExperiences, emptyWork()])
            }
          >
            + Add role
          </button>
        </div>
        <div className="mt-4 space-y-6">
          {form.workExperiences.map((job, index) => (
            <div key={index} className="rounded-lg border border-slate-200 p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Company">
                  <input
                    className={inputClass}
                    value={job.company}
                    onChange={(e) => {
                      const next = [...form.workExperiences];
                      next[index] = { ...job, company: e.target.value };
                      updateField("workExperiences", next);
                    }}
                  />
                </Field>
                <Field label="Title">
                  <input
                    className={inputClass}
                    value={job.title}
                    onChange={(e) => {
                      const next = [...form.workExperiences];
                      next[index] = { ...job, title: e.target.value };
                      updateField("workExperiences", next);
                    }}
                  />
                </Field>
                <Field label="Location">
                  <input
                    className={inputClass}
                    value={job.location ?? ""}
                    onChange={(e) => {
                      const next = [...form.workExperiences];
                      next[index] = { ...job, location: e.target.value };
                      updateField("workExperiences", next);
                    }}
                  />
                </Field>
                <Field label="Start date">
                  <input
                    className={inputClass}
                    value={job.startDate}
                    onChange={(e) => {
                      const next = [...form.workExperiences];
                      next[index] = { ...job, startDate: e.target.value };
                      updateField("workExperiences", next);
                    }}
                  />
                </Field>
                <Field label="End date">
                  <input
                    className={inputClass}
                    value={job.endDate ?? ""}
                    onChange={(e) => {
                      const next = [...form.workExperiences];
                      next[index] = { ...job, endDate: e.target.value };
                      updateField("workExperiences", next);
                    }}
                  />
                </Field>
                <Field label="Current role">
                  <select
                    className={inputClass}
                    value={job.isCurrent ? "yes" : "no"}
                    onChange={(e) => {
                      const next = [...form.workExperiences];
                      next[index] = { ...job, isCurrent: e.target.value === "yes" };
                      updateField("workExperiences", next);
                    }}
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </Field>
                <Field label="Description" className="md:col-span-2">
                  <textarea
                    className={inputClass}
                    rows={3}
                    value={job.description ?? ""}
                    onChange={(e) => {
                      const next = [...form.workExperiences];
                      next[index] = { ...job, description: e.target.value };
                      updateField("workExperiences", next);
                    }}
                  />
                </Field>
              </div>
              {form.workExperiences.length > 1 ? (
                <button
                  type="button"
                  className="mt-3 text-sm text-red-600 hover:underline"
                  onClick={() =>
                    updateField(
                      "workExperiences",
                      form.workExperiences.filter((_, i) => i !== index),
                    )
                  }
                >
                  Remove role
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Education (from PDF or manual)</h2>
          <button
            type="button"
            className="text-sm text-indigo-600 hover:underline"
            onClick={() => updateField("educations", [...form.educations, emptyEducation()])}
          >
            + Add school
          </button>
        </div>
        <div className="mt-4 space-y-6">
          {form.educations.map((edu, index) => (
            <div key={index} className="rounded-lg border border-slate-200 p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="School">
                  <input
                    className={inputClass}
                    value={edu.school}
                    onChange={(e) => {
                      const next = [...form.educations];
                      next[index] = { ...edu, school: e.target.value };
                      updateField("educations", next);
                    }}
                  />
                </Field>
                <Field label="Degree">
                  <input
                    className={inputClass}
                    value={edu.degree}
                    onChange={(e) => {
                      const next = [...form.educations];
                      next[index] = { ...edu, degree: e.target.value };
                      updateField("educations", next);
                    }}
                  />
                </Field>
                <Field label="Field of study">
                  <input
                    className={inputClass}
                    value={edu.fieldOfStudy ?? ""}
                    onChange={(e) => {
                      const next = [...form.educations];
                      next[index] = { ...edu, fieldOfStudy: e.target.value };
                      updateField("educations", next);
                    }}
                  />
                </Field>
                <Field label="GPA">
                  <input
                    className={inputClass}
                    value={edu.gpa ?? ""}
                    onChange={(e) => {
                      const next = [...form.educations];
                      next[index] = { ...edu, gpa: e.target.value };
                      updateField("educations", next);
                    }}
                  />
                </Field>
                <Field label="Start date">
                  <input
                    className={inputClass}
                    value={edu.startDate ?? ""}
                    onChange={(e) => {
                      const next = [...form.educations];
                      next[index] = { ...edu, startDate: e.target.value };
                      updateField("educations", next);
                    }}
                  />
                </Field>
                <Field label="End date">
                  <input
                    className={inputClass}
                    value={edu.endDate ?? ""}
                    onChange={(e) => {
                      const next = [...form.educations];
                      next[index] = { ...edu, endDate: e.target.value };
                      updateField("educations", next);
                    }}
                  />
                </Field>
              </div>
              {form.educations.length > 1 ? (
                <button
                  type="button"
                  className="mt-3 text-sm text-red-600 hover:underline"
                  onClick={() =>
                    updateField(
                      "educations",
                      form.educations.filter((_, i) => i !== index),
                    )
                  }
                >
                  Remove school
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border bg-white p-6">
        <h2 className="font-medium">Skills (from PDF or manual)</h2>
        <Field label="Comma-separated skills">
          <textarea
            className={inputClass}
            rows={4}
            value={skillsText}
            onChange={(e) => setSkillsText(e.target.value)}
            placeholder="JavaScript, Python, AWS..."
          />
        </Field>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void saveProfile()}
          disabled={saving || parsing}
          className="rounded-lg bg-indigo-600 px-5 py-3 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save all changes"}
        </button>
        {status ? <p className="text-sm text-slate-700">{status}</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>
    </div>
  );
}
