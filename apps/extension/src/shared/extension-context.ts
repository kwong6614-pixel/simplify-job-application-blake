export function isRuntimeAvailable(): boolean {
  try {
    return Boolean(chrome.runtime?.id);
  } catch {
    return false;
  }
}

export function isExtensionContextInvalidated(error: unknown): boolean {
  if (typeof error === "string") {
    return (
      error.includes("Extension context invalidated") || error.includes("message port closed")
    );
  }

  return (
    error instanceof Error &&
    (error.message.includes("Extension context invalidated") ||
      error.message.includes("message port closed"))
  );
}

export async function safeSendRuntimeMessage(message: unknown): Promise<boolean> {
  if (!isRuntimeAvailable()) {
    return false;
  }

  try {
    await chrome.runtime.sendMessage(message);
    return true;
  } catch (error) {
    if (isExtensionContextInvalidated(error)) {
      return false;
    }
    throw error;
  }
}

export async function safeGetLocalStorage<T extends string>(
  keys: T[],
): Promise<Partial<Record<T, unknown>>> {
  if (!isRuntimeAvailable()) {
    return {};
  }

  try {
    return await chrome.storage.local.get(keys);
  } catch (error) {
    if (isExtensionContextInvalidated(error)) {
      return {};
    }
    throw error;
  }
}

export function installInvalidContextHandlers(onInvalidated: () => void): void {
  window.addEventListener("unhandledrejection", (event) => {
    if (isExtensionContextInvalidated(event.reason)) {
      event.preventDefault();
      onInvalidated();
    }
  });

  window.addEventListener("error", (event) => {
    if (isExtensionContextInvalidated(event.error ?? event.message)) {
      event.preventDefault();
      onInvalidated();
    }
  });
}
