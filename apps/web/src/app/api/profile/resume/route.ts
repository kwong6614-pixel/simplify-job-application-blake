import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getUserFromExtensionToken } from "@/lib/auth/extension";
import { extractPdfText } from "@/lib/resume/extract-pdf";
import { parseResumeText } from "@/lib/resume/parse";
import { sanitizeOriginalFileName, saveResumePdf } from "@/lib/resume/storage";

export const runtime = "nodejs";

async function resolveUserId(request: Request): Promise<string | null> {
  const session = await auth();
  if (session?.user?.id) return session.user.id;

  const user = await getUserFromExtensionToken(request.headers.get("authorization"));
  return user?.id ?? null;
}

async function loadProfile(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
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

export async function GET(request: Request) {
  const userId = await resolveUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await loadProfile(userId);
  if (!user?.profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  return NextResponse.json({
    email: user.email,
    profile: user.profile,
  });
}

export async function POST(request: Request) {
  const userId = await resolveUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const resumeEntry = formData.get("resume");
  if (!(resumeEntry instanceof File) || resumeEntry.size === 0) {
    return NextResponse.json({ error: "Resume PDF is required" }, { status: 400 });
  }
  if (resumeEntry.type !== "application/pdf") {
    return NextResponse.json({ error: "Resume must be a PDF file" }, { status: 400 });
  }

  try {
    const pdfBuffer = Buffer.from(await resumeEntry.arrayBuffer());
    const resumeText = await extractPdfText(pdfBuffer);
    const parsedResume = await parseResumeText(resumeText);
    const originalFileName = sanitizeOriginalFileName(resumeEntry.name);
    const parsedAt = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.workExperience.deleteMany({ where: { profileId: profile.id } });
      await tx.education.deleteMany({ where: { profileId: profile.id } });
      await tx.skill.deleteMany({ where: { profileId: profile.id } });

      await tx.profile.update({
        where: { id: profile.id },
        data: {
          resumeFileName: originalFileName,
          resumeParsedAt: parsedAt,
          yearsOfExperience: parsedResume.yearsOfExperience ?? null,
          highestEducationLevel: parsedResume.highestEducationLevel ?? null,
          workExperiences: {
            create: parsedResume.workExperiences.map((item, index) => ({
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
            create: parsedResume.educations.map((item, index) => ({
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
            create: parsedResume.skills.map((name) => ({ name })),
          },
        },
      });
    });

    const saved = await saveResumePdf(userId, originalFileName, pdfBuffer);
    await prisma.profile.update({
      where: { id: profile.id },
      data: { resumeFileUrl: saved.storedPath ? saved.storedName : null },
    });

    const user = await loadProfile(userId);
    return NextResponse.json({
      ok: true,
      parsed: {
        workExperiences: parsedResume.workExperiences.length,
        educations: parsedResume.educations.length,
        skills: parsedResume.skills.length,
        resumeParsedAt: parsedAt.toISOString(),
        resumeFileName: originalFileName,
      },
      profile: user?.profile,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Resume parsing failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
