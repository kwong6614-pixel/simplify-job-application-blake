import { getSettings, type TabState } from "../shared/messages";

const apiBaseUrlInput = document.getElementById("apiBaseUrl") as HTMLInputElement;
const extensionTokenInput = document.getElementById("extensionToken") as HTMLInputElement;
const saveSettingsButton = document.getElementById("saveSettings") as HTMLButtonElement;
const connectionStatus = document.getElementById("connectionStatus") as HTMLParagraphElement;
const fillButton = document.getElementById("fillButton") as HTMLButtonElement;
const jobMatch = document.getElementById("jobMatch") as HTMLParagraphElement;
const fieldCount = document.getElementById("fieldCount") as HTMLParagraphElement;
const message = document.getElementById("message") as HTMLParagraphElement;

function renderConnectionStatus(apiBaseUrl: string, extensionToken?: string) {
  if (extensionToken) {
    connectionStatus.textContent = `Connected to ${apiBaseUrl}`;
    connectionStatus.classList.remove("warning");
    return;
  }

  connectionStatus.textContent = "Paste your token and save connection.";
  connectionStatus.classList.add("warning");
}

async function persistSettings(showMessage = true) {
  const apiBaseUrl = apiBaseUrlInput.value.trim().replace(/\/+$/, "");
  const extensionToken = extensionTokenInput.value.trim();

  await chrome.storage.local.set({
    apiBaseUrl: apiBaseUrl || "http://localhost:3000",
    extensionToken,
  });

  apiBaseUrlInput.value = apiBaseUrl || "http://localhost:3000";
  renderConnectionStatus(apiBaseUrlInput.value, extensionToken || undefined);

  if (showMessage) {
    message.textContent = extensionToken
      ? "Connection saved."
      : "Saved API URL. Add your extension token to connect.";
  }
}

async function loadSettings() {
  const settings = await getSettings();
  apiBaseUrlInput.value = settings.apiBaseUrl;
  extensionTokenInput.value = settings.extensionToken ?? "";
  renderConnectionStatus(settings.apiBaseUrl, settings.extensionToken);
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
    const errorMessage =
      error instanceof Error && error.message.includes("Extension context invalidated")
        ? "Extension was reloaded. Refresh this page, then reopen the popup."
        : error instanceof Error
          ? error.message
          : "Could not read tab state.";
    renderState(null, errorMessage);
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
  void persistSettings(true);
});

for (const input of [apiBaseUrlInput, extensionTokenInput]) {
  input.addEventListener("blur", () => {
    void persistSettings(false);
  });
}

void loadSettings().then(refresh);

export {};
