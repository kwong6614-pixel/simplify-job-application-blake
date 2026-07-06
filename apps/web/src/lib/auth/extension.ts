import { prisma } from "@/lib/db";
import { hashToken } from "@/lib/crypto";

const TOKEN_TOUCH_INTERVAL_MS = 60 * 1000;

export async function getUserFromExtensionToken(
  authorizationHeader: string | null,
) {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authorizationHeader.slice("Bearer ".length).trim();
  if (!token) return null;

  const tokenHash = hashToken(token);
  const record = await prisma.extensionToken.findUnique({
    where: { tokenHash },
    include: {
      user: {
        include: {
          profile: {
            include: {
              workExperiences: { orderBy: { sortOrder: "asc" } },
              educations: { orderBy: { sortOrder: "asc" } },
              skills: { orderBy: { name: "asc" } },
            },
          },
        },
      },
    },
  });

  if (!record || record.expiresAt < new Date()) {
    return null;
  }

  const shouldTouch =
    !record.lastUsedAt ||
    Date.now() - record.lastUsedAt.getTime() > TOKEN_TOUCH_INTERVAL_MS;

  if (shouldTouch) {
    void prisma.extensionToken.update({
      where: { id: record.id },
      data: { lastUsedAt: new Date() },
    });
  }

  return record.user;
}
