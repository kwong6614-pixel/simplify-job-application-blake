import { type FormField, type FormSnapshot, type TabReadyPayload } from "../shared/messages";
import {
  isExtensionContextInvalidated,
  isRuntimeAvailable,
  safeSendRuntimeMessage,
} from "../shared/extension-context";
import { shouldActivateContentScript } from "../shared/page-guard";
import { applyFill, collectFields, getAtsPlatform } from "./filler";
import { clearComboboxRegistry } from "./ats/combobox-registry";
import {
  handleTabReadyMessage,
  hideReadyPanel,
  setReadyPanelFilling,
} from "./ready-panel";
import { hideFillLoading, showFillLoading, updateFillLoading } from "./fill-loading";

let publishTimer: number | undefined;
let fillInProgress = false;
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
  if (contentScriptStopped || fillInProgress || !shouldActivateContentScript()) {
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
  if (contentScriptStopped || fillInProgress || !shouldActivateContentScript()) {
    return;
  }

  clearComboboxRegistry();
  const fields = await collectFields();

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

  if (message.type === "SHOW_FILL_LOADING") {
    showFillLoading(
      typeof message.step === "string" ? message.step : "Preparing to fill application...",
    );
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === "UPDATE_FILL_LOADING") {
    updateFillLoading(
      typeof message.step === "string" ? message.step : "Filling application fields...",
    );
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === "HIDE_FILL_LOADING") {
    hideFillLoading();
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === "APPLY_FILL") {
    fillInProgress = true;
    setReadyPanelFilling(true);
    updateFillLoading("Filling application fields...");
    void applyFill(
      message.values as Record<string, string>,
      (message.fields as FormField[] | undefined) ?? [],
    )
      .then(() => sendResponse({ ok: true }))
      .catch((error) => {
        sendResponse({
          error: error instanceof Error ? error.message : "Fill failed",
        });
      })
      .finally(() => {
        fillInProgress = false;
        setReadyPanelFilling(false);
        hideFillLoading();
        schedulePublish();
      });
    return true;
  }

  if (message.type === "TAB_READY_UPDATE") {
    handleTabReadyMessage(message.state as TabReadyPayload);
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === "TAB_NOT_READY") {
    hideReadyPanel();
    sendResponse({ ok: true });
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
