import { NextResponse } from "next/server";
import { resetPasswordWithToken } from "@/lib/auth/password-reset";
import { resetPasswordSchema } from "@/lib/validators";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = resetPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid reset request. Password must be at least 8 characters." },
        { status: 400 },
      );
    }

    const updated = await resetPasswordWithToken(parsed.data.token, parsed.data.password);
    if (!updated) {
      return NextResponse.json(
        { error: "Reset link is invalid or expired. Request a new one." },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Reset password failed", error);
    return NextResponse.json({ error: "Unable to reset password." }, { status: 500 });
  }
}
