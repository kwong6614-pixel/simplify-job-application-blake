export interface FormFieldOption {
  value: string;
  label: string;
}

export type FormFieldType =
  | "text"
  | "textarea"
  | "email"
  | "tel"
  | "number"
  | "url"
  | "select"
  | "combobox";

export interface FormField {
  id: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  maxLength?: number;
  currentValue?: string;
  options?: FormFieldOption[];
}

export interface TabState {
  url: string;
  title: string;
  matched: boolean;
  matchHint?: string;
  job?: {
    company: string;
    role: string;
  };
  fields: FormField[];
  atsPlatform: string;
}

export type RuntimeMessage =
  | { type: "GET_TAB_STATE"; tabId?: number }
  | { type: "TAB_FORM_SNAPSHOT"; tabId: number; snapshot: TabState }
  | { type: "FILL_TAB"; tabId: number }
  | { type: "APPLY_FILL"; values: Record<string, string> };

export async function getSettings() {
  const result = await chrome.storage.local.get(["apiBaseUrl", "extensionToken"]);
  return {
    apiBaseUrl: (result.apiBaseUrl as string | undefined) ?? "http://localhost:3000",
    extensionToken: result.extensionToken as string | undefined,
  };
}

export async function apiFetch(path: string, init?: RequestInit) {
  const { apiBaseUrl, extensionToken } = await getSettings();
  if (!extensionToken) {
    throw new Error("Extension token missing. Connect it from the web app.");
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${extensionToken}`,
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error ?? `Request failed (${response.status})`);
  }

  return response.json();
}
