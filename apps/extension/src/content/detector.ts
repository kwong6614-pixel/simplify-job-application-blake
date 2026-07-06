import { type FormSnapshot } from "../shared/messages";
import {
  isExtensionContextInvalidated,
  isRuntimeAvailable,
  safeSendRuntimeMessage,
} from "../shared/extension-context";
import { shouldActivateContentScript } from "../shared/page-guard";
import { applyFill, collectFields, getAtsPlatform } from "./filler";
import { clearComboboxRegistry } from "./ats/combobox-registry";

let publishTimer: number | undefined;
let lastFields: Awaited<ReturnType<typeof collectFields>> = [];
let contentScriptStopped = false;

const observer = new MutationObserver(schedulePublish);

function stopContentScript(): void {
  if (contentScriptStopped) return;
  contentScriptStopped = true;
  observer.disconnect();
  if (publishTimer) {
    window.clearTimeout(publishTimer);
    publishTimer = undefined;
  }
}

function schedulePublish() {
  if (contentScriptStopped || !shouldActivateContentScript()) {
    stopContentScript();
    return;
  }

  if (publishTimer) window.clearTimeout(publishTimer);
  publishTimer = window.setTimeout(() => {
    void publishSnapshot().catch((error) => {
      if (isExtensionContextInvalidated(error)) {
        stopContentScript();
        return;
      }
      console.error("[jobapply] Failed to publish snapshot", error);
    });
  }, 800);
}

async function publishSnapshot() {
  if (contentScriptStopped || !shouldActivateContentScript()) {
    stopContentScript();
    return;
  }

  clearComboboxRegistry();
  const fields = await collectFields();
  lastFields = fields;

  const snapshot: FormSnapshot = {
    url: window.location.href,
    title: document.title,
    fields,
    atsPlatform: getAtsPlatform(),
  };

  const sent = await safeSendRuntimeMessage({
    type: "TAB_FORM_SNAPSHOT",
    snapshot,
  });
  if (!sent) {
    stopContentScript();
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (contentScriptStopped || !isRuntimeAvailable()) {
    sendResponse({ error: "Extension context invalidated. Reload this tab." });
    return false;
  }

  if (message.type === "APPLY_FILL") {
    void applyFill(message.values as Record<string, string>, lastFields)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => {
        sendResponse({
          error: error instanceof Error ? error.message : "Fill failed",
        });
      });
    return true;
  }

  if (message.type === "REFRESH_SNAPSHOT") {
    void publishSnapshot()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => {
        if (isExtensionContextInvalidated(error)) {
          stopContentScript();
          sendResponse({ error: "Extension context invalidated. Reload this tab." });
          return;
        }
        sendResponse({
          error: error instanceof Error ? error.message : "Refresh failed",
        });
      });
    return true;
  }

  return false;
});

if (shouldActivateContentScript()) {
  void publishSnapshot().catch((error) => {
    if (isExtensionContextInvalidated(error)) {
      stopContentScript();
      return;
    }
    console.error("[jobapply] Failed to publish snapshot", error);
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

export {};
