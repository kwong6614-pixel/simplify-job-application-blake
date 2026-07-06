import { apiFetch, isTabReady, type FormSnapshot, type TabState } from "../shared/messages";

const tabStates = new Map<number, TabState>();
const matchGeneration = new Map<number, number>();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  void handleMessage(message, sender.tab?.id).then(sendResponse);
  return true;
});

async function handleMessage(
  message: { type: string; tabId?: number; snapshot?: FormSnapshot },
  senderTabId?: number,
) {
  if (message.type === "GET_TAB_STATE") {
    const id = message.tabId ?? senderTabId;
    if (!id) return null;
    return tabStates.get(id) ?? null;
  }

  if (message.type === "TAB_FORM_SNAPSHOT" && senderTabId && message.snapshot) {
    await enrichAndStoreTabState(senderTabId, message.snapshot);
    return { ok: true };
  }

  if (message.type === "FILL_TAB" && message.tabId) {
    return fillTab(message.tabId);
  }

  return { error: "Unknown message" };
}

async function enrichAndStoreTabState(tabId: number, snapshot: FormSnapshot) {
  const generation = (matchGeneration.get(tabId) ?? 0) + 1;
  matchGeneration.set(tabId, generation);

  const state: TabState = {
    ...snapshot,
    matched: false,
  };

  try {
    const match = await apiFetch(`/api/jobs/match?url=${encodeURIComponent(snapshot.url)}`);
    if (matchGeneration.get(tabId) !== generation) return;

    state.matched = Boolean(match.matched);
    if (match.job) {
      state.job = {
        company: match.job.company,
        role: match.job.role,
      };
    } else if (match.hint) {
      state.matchHint = match.hint;
    }
  } catch (error) {
    if (matchGeneration.get(tabId) !== generation) return;
    state.matchHint =
      error instanceof Error
        ? error.message
        : "Could not look up JD match. Check extension token and API URL.";
  }

  if (matchGeneration.get(tabId) !== generation) return;

  tabStates.set(tabId, state);
  updateTabAction(tabId, state);
}

function updateTabAction(tabId: number, state: TabState) {
  void chrome.action.enable(tabId);
  if (isTabReady(state)) {
    void chrome.action.setBadgeBackgroundColor({ tabId, color: "#047857" });
    void chrome.action.setBadgeText({ tabId, text: "ON" });
  } else {
    void chrome.action.setBadgeText({ tabId, text: "" });
  }
}

async function fillTab(tabId: number) {
  const state = tabStates.get(tabId);
  if (!isTabReady(state)) {
    if (!state || state.fields.length === 0) {
      return { error: "No application form detected on this tab." };
    }
    return { error: state.matchHint ?? "No JD match for this URL. Sync your sheet first." };
  }

  const result = await apiFetch("/api/fill/generate", {
    method: "POST",
    body: JSON.stringify({
      url: state.url,
      fields: state.fields,
    }),
  });

  await chrome.tabs.sendMessage(tabId, {
    type: "APPLY_FILL",
    values: result.values,
  });

  return { ok: true, unmatchedFieldIds: result.unmatchedFieldIds ?? [] };
}

chrome.tabs.onRemoved.addListener((tabId) => {
  tabStates.delete(tabId);
  matchGeneration.delete(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url) {
    tabStates.delete(tabId);
    matchGeneration.delete(tabId);
    void chrome.action.setBadgeText({ tabId, text: "" });
  }
});

export {};
