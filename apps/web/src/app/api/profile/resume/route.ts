import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { extractPdfText } from "@/lib/resume/extract-pdf";
import { countParsedItems, parseResumeText } from "@/lib/resume/parse";
import { sanitizeOriginalFileName, saveResumePdf } from "@/lib/resume/storage";

export const runtime = "nodejs";
export const maxDuration = 60;

function isPdfFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".pdf") || file.type === "application/pdf" || file.type === "";
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

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
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
    return NextResponse.json({ error: "Choose a PDF file to upload." }, { status: 400 });
  }
  if (!isPdfFile(resumeEntry)) {
    return NextResponse.json({ error: "Only PDF files are supported." }, { status: 400 });
  }

  try {
    const pdfBuffer = Buffer.from(await resumeEntry.arrayBuffer());
    const resumeText = await extractPdfText(pdfBuffer);
    const parseResult = await parseResumeText(resumeText);
    const parsedResume = parseResult.data;
    const originalFileName = sanitizeOriginalFileName(resumeEntry.name);
    const parsedAt = new Date();
    const extractedCount = countParsedItems(parsedResume);

    if (!parseResult.openaiConfigured) {
      return NextResponse.json(
        {
          error: parseResult.error,
          openaiConfigured: false,
          extractedCharacters: parseResult.extractedCharacters,
        },
        { status: 503 },
      );
    }

    if (parseResult.error) {
      return NextResponse.json(
        {
          error: parseResult.error,
          openaiConfigured: true,
          model: parseResult.model,
          extractedCharacters: parseResult.extractedCharacters,
        },
        { status: 400 },
      );
    }

    const saved = await saveResumePdf(userId, originalFileName, pdfBuffer);

    if (extractedCount === 0) {
      await prisma.profile.update({
        where: { id: profile.id },
        data: {
          resumeFileName: originalFileName,
          resumeParsedAt: parsedAt,
          resumeFileUrl: saved.storedPath ? saved.storedName : null,
        },
      });

      const user = await loadProfile(userId);
      return NextResponse.json({
        ok: true,
        updated: false,
        level: "warning",
        message:
          `Read ${parseResult.extractedCharacters.toLocaleString()} characters from the PDF, but no roles, schools, or skills were extracted. Your existing profile data was kept. Try a text-based PDF (not a scan), or fill in the sections below manually.`,
        parsed: {
          workExperiences: 0,
          educations: 0,
          skills: 0,
          extractedCharacters: parseResult.extractedCharacters,
          resumeParsedAt: parsedAt.toISOString(),
          resumeFileName: originalFileName,
          openaiConfigured: true,
          model: parseResult.model,
        },
        profile: user?.profile,
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.workExperience.deleteMany({ where: { profileId: profile.id } });
      await tx.education.deleteMany({ where: { profileId: profile.id } });
      await tx.skill.deleteMany({ where: { profileId: profile.id } });

      await tx.profile.update({
        where: { id: profile.id },
        data: {
          resumeFileName: originalFileName,
          resumeParsedAt: parsedAt,
          resumeFileUrl: saved.storedPath ? saved.storedName : null,
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

    const user = await loadProfile(userId);
    return NextResponse.json({
      ok: true,
      updated: true,
      level: "success",
      message: `Updated your profile from the PDF: ${parsedResume.workExperiences.length} roles, ${parsedResume.educations.length} schools, ${parsedResume.skills.length} skills. Scroll down to review, then click Save all changes if you edit anything.`,
      parsed: {
        workExperiences: parsedResume.workExperiences.length,
        educations: parsedResume.educations.length,
        skills: parsedResume.skills.length,
        extractedCharacters: parseResult.extractedCharacters,
        resumeParsedAt: parsedAt.toISOString(),
        resumeFileName: originalFileName,
        openaiConfigured: true,
        model: parseResult.model,
      },
      profile: user?.profile,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not read this PDF. Use a text-based resume PDF under 5 MB.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
