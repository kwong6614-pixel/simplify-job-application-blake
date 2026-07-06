import { NextResponse } from "next/server";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { getAuthErrorMessage } from "@/lib/auth/errors";
import { loginSchema } from "@/lib/validators";

function isAuthFailureUrl(url: string): boolean {
  return url.includes("error=") || url.includes("/error");
}

function getErrorFromRedirectUrl(url: string, request: Request): string | null {
  try {
    return new URL(url, request.url).searchParams.get("error");
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  if (!process.env.AUTH_SECRET?.trim()) {
    console.error("Login failed: AUTH_SECRET is not configured");
    return NextResponse.json(
      { error: "Sign-in is temporarily unavailable. Please try again later." },
      { status: 503 },
    );
  }

  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const redirectUrl = await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
      redirectTo: "/profile",
    });

    if (typeof redirectUrl === "string" && isAuthFailureUrl(redirectUrl)) {
      const errorCode = getErrorFromRedirectUrl(redirectUrl, request);
      return NextResponse.json(
        { error: getAuthErrorMessage(errorCode) ?? "Invalid email or password." },
        { status: 401 },
      );
    }

    return NextResponse.json({ ok: true, redirectTo: "/profile" });
  } catch (error) {
    if (error instanceof AuthError) {
      const code =
        "code" in error && typeof error.code === "string" ? error.code : error.type;

      return NextResponse.json(
        { error: getAuthErrorMessage(code) ?? "Invalid email or password." },
        { status: 401 },
      );
    }

    console.error("Login failed", error);
    return NextResponse.json(
      { error: "Unable to sign in. Please try again." },
      { status: 500 },
    );
  }
}
