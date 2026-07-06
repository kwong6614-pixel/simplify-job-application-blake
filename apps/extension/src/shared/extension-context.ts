export function isRuntimeAvailable(): boolean {
  try {
    return Boolean(chrome.runtime?.id);
  } catch {
    return false;
  }
}

export function isExtensionContextInvalidated(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes("Extension context invalidated") ||
      error.message.includes("message port closed"))
  );
}

export async function safeSendRuntimeMessage(message: unknown): Promise<void> {
  if (!isRuntimeAvailable()) {
    throw new Error("Extension context invalidated");
  }

  try {
    await chrome.runtime.sendMessage(message);
  } catch (error) {
    if (isExtensionContextInvalidated(error)) {
      throw new Error("Extension context invalidated");
    }
    throw error;
  }
}

export async function safeGetLocalStorage<T extends string>(
  keys: T[],
): Promise<Partial<Record<T, unknown>>> {
  if (!isRuntimeAvailable()) {
    throw new Error("Extension context invalidated");
  }

  try {
    return await chrome.storage.local.get(keys);
  } catch (error) {
    if (isExtensionContextInvalidated(error)) {
      throw new Error("Extension context invalidated");
    }
    throw error;
  }
}
