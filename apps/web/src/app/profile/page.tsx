import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { ensureSheetSyncedForUser } from "@/lib/sheets/auto-sync";
import { getAutoSyncSheetTabNames, isGoogleSheetEnvConfigured } from "@/lib/sheets/config";
import DashboardSync from "@/components/dashboard-sync";
import DashboardProfile, { type DashboardProfileInitial } from "@/components/dashboard-profile";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    include: {
      workExperiences: { orderBy: { sortOrder: "asc" } },
      educations: { orderBy: { sortOrder: "asc" } },
      skills: { orderBy: { name: "asc" } },
    },
  });

  if (!profile) redirect("/signup");

  const { workExperiences, educations, skills } = profile;

  let autoSyncMessage: string | null = null;
  let lastSheetSyncAt: string | null = profile.lastSheetSyncAt?.toISOString() ?? null;
  if (isGoogleSheetEnvConfigured()) {
    try {
      const result = await ensureSheetSyncedForUser(session.user.id);
      if (result.lastSheetSyncAt) {
        lastSheetSyncAt = result.lastSheetSyncAt;
      }
      if (result.ran && result.synced !== undefined) {
        autoSyncMessage = `Synced ${result.synced} jobs from the sheet.`;
      }
    } catch {
      autoSyncMessage = null;
    }
  }

  const syncedJobCount = await prisma.sheetJob.count({
    where: { userId: session.user.id },
  });

  const initialProfile: DashboardProfileInitial = {
    firstName: profile.firstName,
    lastName: profile.lastName,
    middleName: profile.middleName ?? "",
    preferredName: profile.preferredName ?? "",
    pronouns: profile.pronouns ?? "",
    phone: profile.phone,
    addressLine1: profile.addressLine1,
    addressLine2: profile.addressLine2 ?? "",
    city: profile.city,
    state: profile.state,
    zip: profile.zip,
    country: profile.country,
    birthYear: profile.birthYear,
    usWorkAuthorization: profile.usWorkAuthorization as DashboardProfileInitial["usWorkAuthorization"],
    requiresSponsorship: profile.requiresSponsorship,
    gender: profile.gender,
    ethnicity: profile.ethnicity,
    veteranStatus: profile.veteranStatus as DashboardProfileInitial["veteranStatus"],
    disabilityStatus: profile.disabilityStatus as DashboardProfileInitial["disabilityStatus"],
    sexualOrientation: profile.sexualOrientation,
    transgenderStatus: profile.transgenderStatus as DashboardProfileInitial["transgenderStatus"],
    salaryExpectation: profile.salaryExpectation,
    salaryPeriod: profile.salaryPeriod as DashboardProfileInitial["salaryPeriod"],
    jobSource: profile.jobSource,
    linkedinUrl: profile.linkedinUrl ?? "",
    githubUrl: profile.githubUrl ?? "",
    portfolioUrl: profile.portfolioUrl ?? "",
    websiteUrl: profile.websiteUrl ?? "",
    willingToRelocate: profile.willingToRelocate,
    remotePreference: profile.remotePreference as DashboardProfileInitial["remotePreference"],
    earliestStartDate: profile.earliestStartDate ?? "",
    yearsOfExperience: profile.yearsOfExperience ?? undefined,
    highestEducationLevel: profile.highestEducationLevel ?? "",
    resumeFileName: profile.resumeFileName,
    resumeParsedAt: profile.resumeParsedAt?.toISOString() ?? null,
    workExperiences: workExperiences.map(
      ({ company, title, location, startDate, endDate, isCurrent, description }) => ({
        company,
        title,
        location: location ?? "",
        startDate,
        endDate: endDate ?? "",
        isCurrent,
        description: description ?? "",
      }),
    ),
    educations: educations.map(
      ({ school, degree, fieldOfStudy, startDate, endDate, gpa }) => ({
        school,
        degree,
        fieldOfStudy: fieldOfStudy ?? "",
        startDate: startDate ?? "",
        endDate: endDate ?? "",
        gpa: gpa ?? "",
      }),
    ),
    skills: skills.map((skill) => skill.name),
  };

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Dashboard</h1>
          <p className="mt-2 text-slate-600">{session.user.email}</p>
        </div>
        <Link href="/extension" className="text-sm text-indigo-600 hover:underline">
          Extension
        </Link>
      </div>

      <DashboardSync
        sheetConfigured={isGoogleSheetEnvConfigured()}
        sheetTabName={getAutoSyncSheetTabNames()[0] ?? "For Resume"}
        lastSheetSyncAt={lastSheetSyncAt}
        syncedJobCount={syncedJobCount}
        autoSyncEnabled={isGoogleSheetEnvConfigured()}
        autoSyncMessage={autoSyncMessage}
      />

      <DashboardProfile email={session.user.email ?? ""} initialProfile={initialProfile} />
    </main>
  );
}
