import {
  apiFetch,
  isTabReady,
  type FormSnapshot,
  type TabReadyPayload,
  type TabState,
} from "../shared/messages";

/** One entry per open tab — tabs never share or overwrite each other's state. */
const tabStates = new Map<number, TabState>();
const fillsInFlight = new Set<number>();
const autoPopupOpenedTabs = new Set<number>();

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

  if (message.type === "FILL_THIS_TAB" && senderTabId) {
    return fillTab(senderTabId);
  }

  return { error: "Unknown message" };
}

function toReadyPayload(state: TabState): TabReadyPayload {
  return {
    url: state.url,
    atsPlatform: state.atsPlatform,
    fieldCount: state.fields.length,
    job: state.job,
  };
}

async function notifyTabReady(tabId: number, state: TabState) {
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: "TAB_READY_UPDATE",
      state: toReadyPayload(state),
    });
  } catch {
    // Content script not available on this page yet.
  }
}

async function notifyTabNotReady(tabId: number) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "TAB_NOT_READY" });
  } catch {
    // Content script not available on this page yet.
  }
}

async function tryAutoOpenPopup(tabId: number) {
  if (autoPopupOpenedTabs.has(tabId)) return;
  if (typeof chrome.action.openPopup !== "function") return;

  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.active) return;

    const window = await chrome.windows.get(tab.windowId);
    if (!window.focused) return;

    await chrome.action.openPopup({ tabId, windowId: tab.windowId });
    autoPopupOpenedTabs.add(tabId);
  } catch {
    // Popup auto-open is best-effort; the on-page panel still appears.
  }
}

const MATCH_REUSE_MS = 5 * 60 * 1000;

function shouldRefetchJobMatch(
  previous: TabState | undefined,
  snapshot: FormSnapshot,
): boolean {
  if (!previous || previous.url !== snapshot.url) return true;
  if (!previous.fields.length && snapshot.fields.length > 0) return true;
  if (previous.matchedAt && Date.now() - previous.matchedAt < MATCH_REUSE_MS) {
    return false;
  }
  return true;
}

async function enrichAndStoreTabState(tabId: number, snapshot: FormSnapshot) {
  const previous = tabStates.get(tabId);
  const wasReady = isTabReady(previous);

  const state: TabState = { ...snapshot, matched: false };

  if (previous && !shouldRefetchJobMatch(previous, snapshot)) {
    state.matched = previous.matched;
    state.job = previous.job;
    state.matchHint = previous.matchHint;
    state.matchedAt = previous.matchedAt;
  } else {
    try {
      const match = await apiFetch(`/api/jobs/match?url=${encodeURIComponent(snapshot.url)}`);
      state.matched = Boolean(match.matched);
      state.matchedAt = Date.now();
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
  }

  if (!state.matched && state.fields.length > 0) {
    state.matchHint =
      state.matchHint ??
      "Application form detected, but no sheet row matched this URL. Force sync on Dashboard.";
  } else if (state.fields.length === 0 && snapshot.atsPlatform === "ashby") {
    state.matchHint = "Waiting for Ashby application form to load…";
  }

  tabStates.set(tabId, state);
  const nowReady = isTabReady(state);
  setTabEnabled(tabId, nowReady);

  if (nowReady) {
    await notifyTabReady(tabId, state);
    if (!wasReady) {
      await tryAutoOpenPopup(tabId);
    }
  } else {
    autoPopupOpenedTabs.delete(tabId);
    await notifyTabNotReady(tabId);
  }
}

function setTabEnabled(tabId: number, enabled: boolean) {
  if (enabled) {
    void chrome.action.enable(tabId);
  } else {
    void chrome.action.disable(tabId);
  }
}

async function notifyFillLoading(tabId: number, step: string) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "UPDATE_FILL_LOADING", step });
  } catch {
    // Content script not available on this page yet.
  }
}

async function hideFillLoadingOnTab(tabId: number) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "HIDE_FILL_LOADING" });
  } catch {
    // Content script not available on this page yet.
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
    await notifyFillLoading(tabId, "Generating answers from your profile...");
    const result = await apiFetch("/api/fill/generate", {
      method: "POST",
      body: JSON.stringify({ url: state.url, fields: state.fields }),
    });

    await notifyFillLoading(tabId, "Filling application fields...");
    const applyResponse = await chrome.tabs.sendMessage(tabId, {
      type: "APPLY_FILL",
      values: result.values,
      fields: state.fields,
    });

    if (applyResponse?.error) {
      return { error: applyResponse.error as string };
    }

    return { ok: true, unmatchedFieldIds: result.unmatchedFieldIds ?? [] };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Fill failed. Check extension connection.",
    };
  } finally {
    fillsInFlight.delete(tabId);
    await hideFillLoadingOnTab(tabId);
  }
}

chrome.tabs.onActivated.addListener(({ tabId }) => {
  const state = tabStates.get(tabId);
  if (!isTabReady(state)) return;

  void notifyTabReady(tabId, state);
  void tryAutoOpenPopup(tabId);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabStates.delete(tabId);
  fillsInFlight.delete(tabId);
  autoPopupOpenedTabs.delete(tabId);
});

export {};
