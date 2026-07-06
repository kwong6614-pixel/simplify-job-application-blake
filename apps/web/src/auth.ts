import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/crypto";
import { loginSchema } from "@/lib/validators";
import { InvalidCredentialsError } from "@/lib/auth/errors";

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          throw new InvalidCredentialsError();
        }

        try {
          const user = await prisma.user.findUnique({
            where: { email: parsed.data.email.toLowerCase() },
          });

          if (!user) {
            throw new InvalidCredentialsError();
          }

          const valid = await verifyPassword(parsed.data.password, user.passwordHash);
          if (!valid) {
            throw new InvalidCredentialsError();
          }

          return {
            id: user.id,
            email: user.email,
          };
        } catch (error) {
          if (error instanceof InvalidCredentialsError) {
            throw error;
          }

          console.error("Login failed", error);
          throw new InvalidCredentialsError();
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
