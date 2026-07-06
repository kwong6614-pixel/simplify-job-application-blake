import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/crypto";
import { parseSignupFormData } from "@/lib/validators";
import { parseResumeText } from "@/lib/resume/parse";
import { extractPdfText } from "@/lib/resume/extract-pdf";
import { sanitizeOriginalFileName, saveResumePdf } from "@/lib/resume/storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const parsedFields = parseSignupFormData(formData);

    if (!parsedFields.success) {
      return NextResponse.json(
        { error: "Invalid signup data", details: parsedFields.error.flatten() },
        { status: 400 },
      );
    }

    const resumeEntry = formData.get("resume");
    if (!(resumeEntry instanceof File) || resumeEntry.size === 0) {
      return NextResponse.json({ error: "Resume PDF is required" }, { status: 400 });
    }

    if (resumeEntry.type !== "application/pdf") {
      return NextResponse.json({ error: "Resume must be a PDF file" }, { status: 400 });
    }

    const data = parsedFields.data;
    const email = data.email.toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const pdfBuffer = Buffer.from(await resumeEntry.arrayBuffer());
    const resumeText = await extractPdfText(pdfBuffer);
    const parsedResume = await parseResumeText(resumeText);

    const workExperiences = data.workExperiences.length
      ? data.workExperiences
      : parsedResume.workExperiences;
    const educations = data.educations.length ? data.educations : parsedResume.educations;
    const skills = data.skills.length ? data.skills : parsedResume.skills;

    const passwordHash = await hashPassword(data.password);
    const originalFileName = sanitizeOriginalFileName(resumeEntry.name);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        profile: {
          create: {
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
            yearsOfExperience: data.yearsOfExperience ?? parsedResume.yearsOfExperience,
            highestEducationLevel:
              data.highestEducationLevel ?? parsedResume.highestEducationLevel,
            resumeFileName: originalFileName,
            resumeParsedAt: new Date(),
            workExperiences: {
              create: workExperiences.map((item, index) => ({
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
              create: educations.map((item, index) => ({
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
              create: skills.map((name) => ({ name })),
            },
          },
        },
      },
      select: { id: true, email: true },
    });

    const saved = await saveResumePdf(user.id, originalFileName, pdfBuffer);
    await prisma.profile.update({
      where: { userId: user.id },
      data: {
        resumeFileUrl: saved.storedPath ? saved.storedName : null,
      },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    console.error("Signup failed", error);
    const message = error instanceof Error ? error.message : "Signup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
