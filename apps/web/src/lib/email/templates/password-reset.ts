function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildPasswordResetEmail(params: {
  appName: string;
  resetUrl: string;
  expiresInHours: number;
}): { subject: string; html: string; text: string } {
  const { appName, resetUrl, expiresInHours } = params;
  const safeAppName = escapeHtml(appName);
  const safeResetUrl = escapeHtml(resetUrl);

  const subject = `Reset your ${appName} password`;

  const text = [
    `You requested a password reset for ${appName}.`,
    "",
    `Reset your password: ${resetUrl}`,
    "",
    `This link expires in ${expiresInHours} hour${expiresInHours === 1 ? "" : "s"}.`,
    "If you did not request this, you can ignore this email.",
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:32px;">
            <tr>
              <td>
                <p style="margin:0 0 8px;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#4f46e5;">${safeAppName}</p>
                <h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;">Reset your password</h1>
                <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#475569;">
                  We received a request to reset the password for your account. Click the button below to choose a new password.
                </p>
                <p style="margin:0 0 24px;">
                  <a href="${safeResetUrl}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 20px;border-radius:8px;">
                    Reset password
                  </a>
                </p>
                <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#64748b;">
                  This link expires in ${expiresInHours} hour${expiresInHours === 1 ? "" : "s"}.
                </p>
                <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#64748b;">
                  If the button does not work, copy and paste this URL into your browser:
                </p>
                <p style="margin:0 0 24px;font-size:13px;line-height:1.6;word-break:break-all;">
                  <a href="${safeResetUrl}" style="color:#4f46e5;">${safeResetUrl}</a>
                </p>
                <p style="margin:0;font-size:13px;line-height:1.6;color:#94a3b8;">
                  If you did not request a password reset, you can safely ignore this email.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, html, text };
}
