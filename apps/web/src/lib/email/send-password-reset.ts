import { Resend } from "resend";
import {
  getEmailConfig,
  isEmailConfigured,
  isProductionEmailRequired,
} from "@/lib/email/config";
import { buildPasswordResetEmail } from "@/lib/email/templates/password-reset";

const RESET_EXPIRES_HOURS = 1;

export class EmailDeliveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailDeliveryError";
  }
}

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
): Promise<void> {
  if (!isEmailConfigured()) {
    if (isProductionEmailRequired()) {
      throw new EmailDeliveryError(
        "Password reset email is not configured. Set RESEND_API_KEY and EMAIL_FROM.",
      );
    }

    console.info("[password-reset] Reset link:", resetUrl);
    return;
  }

  const config = getEmailConfig();
  const resend = new Resend(config.apiKey);
  const { subject, html, text } = buildPasswordResetEmail({
    appName: config.appName,
    resetUrl,
    expiresInHours: RESET_EXPIRES_HOURS,
  });

  const { data, error } = await resend.emails.send({
    from: config.from,
    to,
    subject,
    html,
    text,
    replyTo: config.replyTo,
  });

  if (error) {
    console.error("[password-reset] Resend error:", error);
    throw new EmailDeliveryError(error.message || "Failed to send password reset email");
  }

  if (!data?.id) {
    throw new EmailDeliveryError("Failed to send password reset email");
  }
}
