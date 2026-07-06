export interface EmailConfig {
  apiKey: string;
  from: string;
  replyTo?: string;
  appName: string;
  baseUrl: string;
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim());
}

export function getAppBaseUrl(): string {
  return (
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    "http://localhost:3000"
  ).replace(/\/+$/, "");
}

export function getEmailConfig(): EmailConfig {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  const replyTo = process.env.EMAIL_REPLY_TO?.trim();

  if (!apiKey || !from) {
    throw new Error("RESEND_API_KEY and EMAIL_FROM must be set");
  }

  return {
    apiKey,
    from,
    replyTo: replyTo || undefined,
    appName: process.env.APP_NAME?.trim() || "JobApply",
    baseUrl: getAppBaseUrl(),
  };
}

export function isProductionEmailRequired(): boolean {
  return process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
}
