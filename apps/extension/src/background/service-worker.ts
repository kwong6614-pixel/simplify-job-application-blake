import { apiFetch, isTabReady, type FormSnapshot, type TabState } from "../shared/messages";

/** One entry per open tab — tabs never share or overwrite each other's state. */
const tabStates = new Map<number, TabState>();
const fillsInFlight = new Set<number>();

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
  const state: TabState = { ...snapshot, matched: false };

  try {
    const match = await apiFetch(`/api/jobs/match?url=${encodeURIComponent(snapshot.url)}`);
    state.matched = Boolean(match.matched);
    if (match.job) {
      state.job = { company: match.job.company, role: match.job.role };
    } else if (match.hint) {
      state.matchHint = match.hint;
    }
  } catch (error) {
    state.matchHint =
      error instanceof Error
        ? error.message
        : "Could not look up JD match. Check extension token and API URL.";
  }

  tabStates.set(tabId, state);
  setTabEnabled(tabId, isTabReady(state));
}

function setTabEnabled(tabId: number, enabled: boolean) {
  if (enabled) {
    void chrome.action.enable(tabId);
  } else {
    void chrome.action.disable(tabId);
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

  if (fillsInFlight.has(tabId)) {
    return { error: "Fill already in progress on this tab." };
  }

  fillsInFlight.add(tabId);
  try {
    const result = await apiFetch("/api/fill/generate", {
      method: "POST",
      body: JSON.stringify({ url: state.url, fields: state.fields }),
    });

    await chrome.tabs.sendMessage(tabId, {
      type: "APPLY_FILL",
      values: result.values,
      fields: state.fields,
    });

    return { ok: true, unmatchedFieldIds: result.unmatchedFieldIds ?? [] };
  } finally {
    fillsInFlight.delete(tabId);
  }
}

chrome.tabs.onRemoved.addListener((tabId) => {
  tabStates.delete(tabId);
  fillsInFlight.delete(tabId);
});

export {};
