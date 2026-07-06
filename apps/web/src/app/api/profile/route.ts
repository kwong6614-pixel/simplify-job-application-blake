import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getUserFromExtensionToken } from "@/lib/auth/extension";

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
            skills: true,
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
