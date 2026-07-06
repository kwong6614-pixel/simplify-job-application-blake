import { NextResponse } from "next/server";
import { requestPasswordReset } from "@/lib/auth/password-reset";
import { EmailDeliveryError } from "@/lib/email/send-password-reset";
import { forgotPasswordSchema } from "@/lib/validators";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = forgotPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    await requestPasswordReset(parsed.data.email);

    return NextResponse.json({
      ok: true,
      message:
        "If an account exists for that email, we sent a password reset link. Check your inbox.",
    });
  } catch (error) {
    console.error("Forgot password failed", error);

    if (error instanceof EmailDeliveryError) {
      return NextResponse.json(
        {
          error:
            "Password reset email is temporarily unavailable. Please try again later or contact support.",
        },
        { status: 503 },
      );
    }

    return NextResponse.json({ error: "Unable to process request." }, { status: 500 });
  }
}
