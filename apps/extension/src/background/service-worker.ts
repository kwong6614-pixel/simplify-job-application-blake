import { apiFetch, type TabState } from "../shared/messages";

const tabStates = new Map<number, TabState>();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  void handleMessage(message, sender.tab?.id).then(sendResponse);
  return true;
});

async function handleMessage(
  message: { type: string; tabId?: number; snapshot?: TabState },
  senderTabId?: number,
) {
  if (message.type === "GET_TAB_STATE") {
    const id = message.tabId ?? senderTabId;
    if (!id) return null;
    return tabStates.get(id) ?? null;
  }

  if (message.type === "TAB_FORM_SNAPSHOT" && senderTabId && message.snapshot) {
    tabStates.set(senderTabId, message.snapshot);
    return { ok: true };
  }

  if (message.type === "FILL_TAB" && message.tabId) {
    return fillTab(message.tabId);
  }

  return { error: "Unknown message" };
}

async function fillTab(tabId: number) {
  const state = tabStates.get(tabId);
  if (!state || state.fields.length === 0) {
    return { error: "No form detected on this tab" };
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
});

export {};
