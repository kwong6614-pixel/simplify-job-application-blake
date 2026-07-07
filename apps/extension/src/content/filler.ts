import type { FormField } from "../../shared/messages";
import { getAtsAdapter } from "./ats";
import { getCombobox } from "./ats/combobox-registry";
import { applyComboboxValue, resolveComboboxTrigger, sleep } from "./ats/combobox";
import { applySelectValue, applyRadioGroupValue } from "./ats/shared";

export function applyControlValue(element: HTMLElement, value: string): boolean {
  if (element.tagName.toLowerCase() === "select") {
    return applySelectValue(element as HTMLSelectElement, value);
  }

  const input = element as HTMLInputElement | HTMLTextAreaElement;
  input.focus();
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  input.dispatchEvent(new Event("blur", { bubbles: true }));
  return true;
}

export async function applyFill(values: Record<string, string>, fields: FormField[]) {
  const fieldMap = new Map(fields.map((field) => [field.id, field]));
  const adapter = getAtsAdapter(window.location.hostname, window.location.href, document);

  const syncFields: Array<[string, string, FormField]> = [];
  const comboboxFields: Array<[string, string, FormField]> = [];

  for (const [id, value] of Object.entries(values)) {
    if (!value.trim()) continue;
    const meta = fieldMap.get(id);
    if (!meta) continue;

    if (meta.type === "combobox") {
      comboboxFields.push([id, value, meta]);
    } else {
      syncFields.push([id, value, meta]);
    }
  }

  for (const [id, value, meta] of syncFields) {
    const element = adapter.resolveElement(id, meta.label);
    if (element) {
      applyControlValue(element, value);
      continue;
    }

    if (meta.type === "select") {
      applyRadioGroupValue(document, id, value, meta.options);
    }
  }

  for (const [id, value, meta] of comboboxFields) {
    const handle = getCombobox(id);
    const trigger =
      handle?.trigger ??
      resolveComboboxTrigger(document, id) ??
      adapter.resolveElement(id, meta.label);

    if (!trigger) continue;

    await applyComboboxValue(document, trigger, value, meta.options);
    await sleep(180);
  }
}

export async function collectFields(): Promise<FormField[]> {
  const adapter = getAtsAdapter(window.location.hostname, window.location.href, document);
  return adapter.collectFields(document);
}

export function getAtsPlatform(): string {
  return getAtsAdapter(window.location.hostname, window.location.href, document).id;
}
