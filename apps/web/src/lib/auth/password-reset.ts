import { prisma } from "@/lib/db";
import { createExtensionToken, hashPassword, hashToken } from "@/lib/crypto";
import { sendPasswordResetEmail } from "@/lib/email/send-password-reset";

const RESET_TTL_MS = 60 * 60 * 1000;

function getResetBaseUrl(): string {
  return (
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    "http://localhost:3000"
  );
}

export async function requestPasswordReset(email: string): Promise<void> {
  const normalizedEmail = email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (!user) {
    return;
  }

  const { token, tokenHash } = createExtensionToken();
  const expiresAt = new Date(Date.now() + RESET_TTL_MS);

  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  const resetUrl = `${getResetBaseUrl()}/reset-password?token=${token}`;
  await sendPasswordResetEmail(user.email, resetUrl);
}

export async function resetPasswordWithToken(
  token: string,
  newPassword: string,
): Promise<boolean> {
  const tokenHash = hashToken(token);
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!resetToken || resetToken.expiresAt < new Date()) {
    return false;
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.delete({ where: { id: resetToken.id } }),
    prisma.passwordResetToken.deleteMany({ where: { userId: resetToken.userId } }),
  ]);

  return true;
}
