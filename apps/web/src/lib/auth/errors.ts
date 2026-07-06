export function getAuthErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null;

  switch (code) {
    case "CredentialsSignin":
    case "invalid_credentials":
      return "Invalid email or password.";
    case "Configuration":
      return "Sign-in is temporarily unavailable. Please try again later.";
    default:
      return "Unable to sign in. Please try again.";
  }
}
