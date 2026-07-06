import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/crypto";
import { loginSchema } from "@/lib/validators";

export type AuthenticatedUser = {
  id: string;
  email: string;
};

export async function validateCredentials(
  credentials: unknown,
): Promise<AuthenticatedUser | null> {
  const parsed = loginSchema.safeParse(credentials);
  if (!parsed.success) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  });

  if (!user) {
    return null;
  }

  const valid = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!valid) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
  };
}
