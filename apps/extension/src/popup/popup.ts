import { getSettings, isTabReady, type TabState } from "../shared/messages";

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

/** Popup always reflects the tab you opened it from — no cross-tab aggregation. */
async function getThisTabState(): Promise<{ tabId: number; state: TabState | null } | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return null;

  try {
    await chrome.tabs.sendMessage(tab.id, { type: "REFRESH_SNAPSHOT" });
  } catch {
    // Content script not injected on this page yet.
  }

  const state = (await chrome.runtime.sendMessage({
    type: "GET_TAB_STATE",
    tabId: tab.id,
  })) as TabState | null;

  return { tabId: tab.id, state };
}

function renderState(state: TabState | null, errorMessage?: string | null) {
  if (errorMessage) {
    jobMatch.textContent = errorMessage;
    fieldCount.textContent = "";
    fillButton.disabled = true;
    return;
  }

  if (!state) {
    jobMatch.textContent = "No form detected on this tab yet.";
    fieldCount.textContent = "";
    fillButton.disabled = true;
    return;
  }

  const hasForm = state.fields.length > 0;
  const hasJd = state.matched;
  const ready = isTabReady(state);

  if (ready) {
    jobMatch.textContent = `Ready: ${state.job?.company ?? "Company"} — ${state.job?.role ?? "Role"}`;
  } else if (!hasForm) {
    jobMatch.textContent = "No application form on this tab.";
  } else {
    jobMatch.textContent = state.matchHint ?? "Form found, but no JD match for this URL.";
  }

  const selectCount = state.fields.filter(
    (field) => field.type === "select" || field.type === "combobox",
  ).length;
  const textCount = state.fields.length - selectCount;
  fieldCount.textContent = hasForm
    ? `${state.fields.length} fields (${textCount} text, ${selectCount} dropdown) on ${state.atsPlatform}. JD: ${hasJd ? "found" : "not found"}.`
    : "";
  fillButton.disabled = !ready;
}

async function refresh() {
  try {
    const tabInfo = await getThisTabState();
    if (!tabInfo) {
      renderState(null, "No active tab.");
      return;
    }
    renderState(tabInfo.state);
  } catch (error) {
    const errorMessage =
      error instanceof Error && error.message.includes("Extension context invalidated")
        ? "Extension was reloaded. Refresh this tab, then reopen the popup."
        : error instanceof Error
          ? error.message
          : "Could not read tab state.";
    renderState(null, errorMessage);
  }
}

fillButton.addEventListener("click", async () => {
  message.textContent = "Filling this tab...";
  fillButton.disabled = true;

  const tabInfo = await getThisTabState();
  if (!tabInfo) {
    message.textContent = "No active tab.";
    await refresh();
    return;
  }

  const response = await chrome.runtime.sendMessage({
    type: "FILL_TAB",
    tabId: tabInfo.tabId,
  });

  if (response?.error) {
    message.textContent = response.error;
  } else {
    const unmatched = (response?.unmatchedFieldIds as string[] | undefined) ?? [];
    message.textContent =
      unmatched.length > 0
        ? `Filled. ${unmatched.length} fields still blank.`
        : "Filled successfully.";
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
