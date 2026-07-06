import { DEFAULT_SHEET_TAB_NAMES, SHEET_TAB_NAME } from "@app/shared";

export function getGoogleSheetEnvConfig() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID?.trim();
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN?.trim();
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

  if (!spreadsheetId || !refreshToken) {
    throw new Error("GOOGLE_SHEETS_ID and GOOGLE_REFRESH_TOKEN must be set in environment variables");
  }

  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in environment variables");
  }

  return {
    spreadsheetId,
    refreshToken,
    clientId,
    clientSecret,
    sheetTabNames: getSheetTabNames(),
  };
}

export function getSheetTabNames(): string[] {
  const configuredTabs = process.env.GOOGLE_SHEET_TAB_NAMES?.trim();
  if (configuredTabs) {
    return configuredTabs
      .split(",")
      .map((tab) => tab.trim())
      .filter(Boolean);
  }

  const singleTab = process.env.GOOGLE_SHEET_TAB_NAME?.trim();
  if (singleTab) {
    return [singleTab];
  }

  return [...DEFAULT_SHEET_TAB_NAMES];
}

export function isGoogleSheetEnvConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_SHEETS_ID?.trim() &&
      process.env.GOOGLE_REFRESH_TOKEN?.trim() &&
      process.env.GOOGLE_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CLIENT_SECRET?.trim(),
  );
}

export function getPrimarySheetTabName(): string {
  return getSheetTabNames()[0] ?? SHEET_TAB_NAME;
}
