import {
  installInvalidContextHandlers,
  isExtensionContextInvalidated,
  isRuntimeAvailable,
} from "../shared/extension-context";
import { shouldActivateContentScript } from "../shared/page-guard";

function stopStaleScript(): void {
  // No-op marker for invalidated contexts on pages that should never run JobApply.
}

installInvalidContextHandlers(stopStaleScript);

if (!isRuntimeAvailable() || !shouldActivateContentScript()) {
  stopStaleScript();
} else {
  void import("./detector").catch((error) => {
    if (!isExtensionContextInvalidated(error)) {
      console.error("[jobapply] Failed to start content script", error);
    }
  });
}

export {};
