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

export interface FormSnapshot {
  url: string;
  title: string;
  fields: FormField[];
  atsPlatform: string;
}

export interface TabState extends FormSnapshot {
  matched: boolean;
  matchedAt?: number;
  matchHint?: string;
  job?: {
    company: string;
    role: string;
  };
}

/** Ready when this tab has an application form and a matched JD. */
export function isTabReady(state: TabState | null | undefined): boolean {
  return Boolean(state && state.fields.length > 0 && state.matched);
}

export type RuntimeMessage =
  | { type: "GET_TAB_STATE"; tabId?: number }
  | { type: "TAB_FORM_SNAPSHOT"; snapshot: FormSnapshot }
  | { type: "FILL_TAB"; tabId: number }
  | { type: "APPLY_FILL"; values: Record<string, string>; fields: FormField[] }
  | { type: "REFRESH_SNAPSHOT" }
  | { type: "TAB_READY_UPDATE"; state: TabReadyPayload }
  | { type: "TAB_NOT_READY" };

/** Lightweight state sent to the content script for the on-page panel. */
export type TabReadyPayload = {
  url: string;
  atsPlatform: string;
  fieldCount: number;
  job?: {
    company: string;
    role: string;
  };
};

import {
  isRuntimeAvailable,
  safeGetLocalStorage,
} from "./extension-context";

export async function getSettings() {
  const result = await safeGetLocalStorage(["apiBaseUrl", "extensionToken"]);
  return {
    apiBaseUrl: (result.apiBaseUrl as string | undefined) ?? "http://localhost:3000",
    extensionToken: result.extensionToken as string | undefined,
  };
}

export async function apiFetch(path: string, init?: RequestInit) {
  const { apiBaseUrl, extensionToken } = await getSettings();
  if (!extensionToken) {
    if (!isRuntimeAvailable()) {
      throw new Error("Extension context invalidated. Reload this tab.");
    }
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
