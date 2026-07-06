import { apiFetch, type TabState } from "../shared/messages";
import { applyFill, collectFields, getAtsPlatform } from "./filler";
import { clearComboboxRegistry } from "./ats/combobox-registry";

let publishTimer: number | undefined;
let lastFields: Awaited<ReturnType<typeof collectFields>> = [];
let collectInFlight = false;

async function publishSnapshot() {
  if (collectInFlight) return;
  collectInFlight = true;

  try {
    clearComboboxRegistry();
    const fields = await collectFields();
    lastFields = fields;

    const snapshot: TabState = {
      url: window.location.href,
      title: document.title,
      matched: false,
      fields,
      atsPlatform: getAtsPlatform(),
    };

    try {
      const match = await apiFetch(`/api/jobs/match?url=${encodeURIComponent(snapshot.url)}`);
      snapshot.matched = Boolean(match.matched);
      if (match.job) {
        snapshot.job = {
          company: match.job.company,
          role: match.job.role,
        };
      }
    } catch {
      snapshot.matched = false;
    }

    await chrome.runtime.sendMessage({
      type: "TAB_FORM_SNAPSHOT",
      snapshot,
    });
  } finally {
    collectInFlight = false;
  }
}

function schedulePublish() {
  if (publishTimer) window.clearTimeout(publishTimer);
  publishTimer = window.setTimeout(() => {
    void publishSnapshot();
  }, 800);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "APPLY_FILL") {
    void applyFill(message.values as Record<string, string>, lastFields).then(() => {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message.type === "REFRESH_SNAPSHOT") {
    void publishSnapshot().then(() => sendResponse({ ok: true }));
    return true;
  }

  return false;
});

void publishSnapshot();

const observer = new MutationObserver(schedulePublish);
observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
});

export {};
