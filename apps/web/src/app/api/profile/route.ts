import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getUserFromExtensionToken } from "@/lib/auth/extension";
import { profileUpdateSchema } from "@/lib/validators";

async function resolveUser(request: Request) {
  const session = await auth();
  if (session?.user?.id) {
    return prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        profile: {
          include: {
            workExperiences: { orderBy: { sortOrder: "asc" } },
            educations: { orderBy: { sortOrder: "asc" } },
            skills: { orderBy: { name: "asc" } },
          },
        },
      },
    });
  }

  return getUserFromExtensionToken(request.headers.get("authorization"));
}

export async function GET(request: Request) {
  const user = await resolveUser(request);
  if (!user?.profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    email: user.email,
    profile: user.profile,
  });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = profileUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid profile data", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const data = parsed.data;

  await prisma.$transaction(async (tx) => {
    await tx.workExperience.deleteMany({ where: { profileId: profile.id } });
    await tx.education.deleteMany({ where: { profileId: profile.id } });
    await tx.skill.deleteMany({ where: { profileId: profile.id } });

    await tx.profile.update({
      where: { id: profile.id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        middleName: data.middleName || null,
        preferredName: data.preferredName || null,
        pronouns: data.pronouns || null,
        phone: data.phone,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2 || null,
        city: data.city,
        state: data.state,
        zip: data.zip,
        country: data.country,
        birthYear: data.birthYear,
        usWorkAuthorization: data.usWorkAuthorization,
        requiresSponsorship: data.requiresSponsorship,
        gender: data.gender,
        ethnicity: data.ethnicity,
        veteranStatus: data.veteranStatus,
        disabilityStatus: data.disabilityStatus,
        sexualOrientation: data.sexualOrientation,
        transgenderStatus: data.transgenderStatus,
        salaryExpectation: data.salaryExpectation,
        salaryPeriod: data.salaryPeriod,
        jobSource: data.jobSource,
        linkedinUrl: data.linkedinUrl || null,
        githubUrl: data.githubUrl || null,
        portfolioUrl: data.portfolioUrl || null,
        websiteUrl: data.websiteUrl || null,
        willingToRelocate: data.willingToRelocate,
        remotePreference: data.remotePreference,
        earliestStartDate: data.earliestStartDate || null,
        yearsOfExperience: data.yearsOfExperience ?? null,
        highestEducationLevel: data.highestEducationLevel || null,
        workExperiences: {
          create: data.workExperiences.map((item, index) => ({
            company: item.company,
            title: item.title,
            location: item.location || null,
            startDate: item.startDate,
            endDate: item.endDate || null,
            isCurrent: item.isCurrent,
            description: item.description || null,
            sortOrder: index,
          })),
        },
        educations: {
          create: data.educations.map((item, index) => ({
            school: item.school,
            degree: item.degree,
            fieldOfStudy: item.fieldOfStudy || null,
            startDate: item.startDate || null,
            endDate: item.endDate || null,
            gpa: item.gpa || null,
            sortOrder: index,
          })),
        },
        skills: {
          create: data.skills.map((name) => ({ name })),
        },
      },
    });
  });

  const updated = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    include: {
      workExperiences: { orderBy: { sortOrder: "asc" } },
      educations: { orderBy: { sortOrder: "asc" } },
      skills: { orderBy: { name: "asc" } },
    },
  });

  return NextResponse.json({ ok: true, profile: updated });
}
