export type ComboboxPlatform =
  | "workday"
  | "ashby"
  | "greenhouse"
  | "lever"
  | "workable"
  | "rippling"
  | "gusto"
  | "generic";

export interface ComboboxHandle {
  id: string;
  trigger: HTMLElement;
  platform: ComboboxPlatform;
}

const registry = new Map<string, ComboboxHandle>();

export function registerCombobox(handle: ComboboxHandle): void {
  registry.set(handle.id, handle);
}

export function getCombobox(id: string): ComboboxHandle | null {
  return registry.get(id) ?? null;
}

export function clearComboboxRegistry(): void {
  registry.clear();
}

export function listComboboxes(): ComboboxHandle[] {
  return Array.from(registry.values());
}
