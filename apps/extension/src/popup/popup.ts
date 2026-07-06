import { getSettings, type TabState } from "../shared/messages";

const apiBaseUrlInput = document.getElementById("apiBaseUrl") as HTMLInputElement;
const extensionTokenInput = document.getElementById("extensionToken") as HTMLInputElement;
const saveSettingsButton = document.getElementById("saveSettings") as HTMLButtonElement;
const fillButton = document.getElementById("fillButton") as HTMLButtonElement;
const jobMatch = document.getElementById("jobMatch") as HTMLParagraphElement;
const fieldCount = document.getElementById("fieldCount") as HTMLParagraphElement;
const message = document.getElementById("message") as HTMLParagraphElement;

async function loadSettings() {
  const settings = await getSettings();
  apiBaseUrlInput.value = settings.apiBaseUrl;
  extensionTokenInput.value = settings.extensionToken ?? "";
}

async function saveSettings() {
  await chrome.storage.local.set({
    apiBaseUrl: apiBaseUrlInput.value.trim(),
    extensionToken: extensionTokenInput.value.trim(),
  });
  message.textContent = "Connection saved.";
}

async function getActiveTabState(): Promise<TabState | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return null;

  await chrome.tabs.sendMessage(tab.id, { type: "REFRESH_SNAPSHOT" }).catch(() => undefined);

  const response = await chrome.runtime.sendMessage({
    type: "GET_TAB_STATE",
    tabId: tab.id,
  });

  return response as TabState | null;
}

function renderState(state: TabState | null, errorMessage?: string | null) {
  if (errorMessage) {
    jobMatch.textContent = errorMessage;
    fieldCount.textContent = "";
    fillButton.disabled = true;
    return;
  }

  if (!state) {
    jobMatch.textContent = "No tab state yet.";
    fieldCount.textContent = "";
    fillButton.disabled = true;
    return;
  }

  jobMatch.textContent = state.matched
    ? `Matched: ${state.job?.company ?? "Unknown company"} — ${state.job?.role ?? "Role"}`
    : state.matchHint ?? "No JD match for this URL yet.";

  const selectCount = state.fields.filter(
    (field) => field.type === "select" || field.type === "combobox",
  ).length;
  const textCount = state.fields.length - selectCount;
  fieldCount.textContent = `${state.fields.length} fields detected (${textCount} text, ${selectCount} dropdown/combobox) on ${state.atsPlatform}.`;
  fillButton.disabled = state.fields.length === 0;
}

async function refresh() {
  try {
    const state = await getActiveTabState();
    renderState(state);
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("Extension context invalidated")
        ? "Extension was reloaded. Refresh this page, then reopen the popup."
        : error instanceof Error
          ? error.message
          : "Could not read tab state.";
    renderState(null, message);
  }
}

fillButton.addEventListener("click", async () => {
  message.textContent = "Filling...";
  fillButton.disabled = true;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    message.textContent = "No active tab.";
    return;
  }

  const response = await chrome.runtime.sendMessage({
    type: "FILL_TAB",
    tabId: tab.id,
  });

  if (response?.error) {
    message.textContent = response.error;
  } else {
    const unmatched = (response?.unmatchedFieldIds as string[] | undefined) ?? [];
    message.textContent =
      unmatched.length > 0
        ? `Filled tab. ${unmatched.length} fields still blank.`
        : "Filled tab successfully.";
  }

  await refresh();
});

saveSettingsButton.addEventListener("click", () => {
  void saveSettings();
});

void loadSettings().then(refresh);

export {};
