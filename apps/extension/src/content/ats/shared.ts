import type { FormField, FormFieldOption } from "../../shared/messages";
import { isComboboxTrigger } from "./combobox";

export interface AtsAdapter {
  id: string;
  matches(hostname: string, url: string): boolean;
  collectFields(document: Document): FormField[] | Promise<FormField[]>;
  resolveElement(id: string, label?: string): HTMLElement | null;
  collectComboboxFields?(document: Document): Promise<FormField[]>;
}

export function isVisible(element: HTMLElement): boolean {
  if (element.closest('[aria-hidden="true"]')) return false;
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") return false;
  if (element.getAttribute("aria-hidden") === "true") return false;
  return true;
}

export function isTextLikeInput(
  element: HTMLElement,
): element is HTMLInputElement | HTMLTextAreaElement {
  if (element.tagName.toLowerCase() === "textarea") return true;
  if (element.tagName.toLowerCase() !== "input") return false;

  const input = element as HTMLInputElement;
  const allowed = new Set(["text", "email", "tel", "url", "number", ""]);
  return allowed.has(input.type);
}

export function isSelectElement(element: HTMLElement): element is HTMLSelectElement {
  return element.tagName.toLowerCase() === "select";
}

export function isFormControl(element: HTMLElement): element is
  | HTMLInputElement
  | HTMLTextAreaElement
  | HTMLSelectElement {
  return isTextLikeInput(element) || isSelectElement(element);
}

export function shouldSkipInput(element: HTMLInputElement | HTMLTextAreaElement): boolean {
  if (element.disabled || element.readOnly) return true;
  if (!isVisible(element)) return true;
  if (element.type === "hidden") return true;
  if (element.type === "file" || element.type === "submit" || element.type === "button") {
    return true;
  }
  if (element.type === "search") return true;
  if (element.closest('[role="search"]')) return true;
  return false;
}

export function shouldSkipSelect(element: HTMLSelectElement): boolean {
  if (element.disabled) return true;
  if (!isVisible(element)) return true;
  if (element.type === "hidden") return true;
  return false;
}

export function getInputType(
  element: HTMLInputElement | HTMLTextAreaElement,
): FormField["type"] {
  if (element.tagName.toLowerCase() === "textarea") return "textarea";
  const type = (element as HTMLInputElement).type;
  if (type === "email" || type === "tel" || type === "url" || type === "number") {
    return type;
  }
  return "text";
}

export function getSelectOptions(select: HTMLSelectElement): FormFieldOption[] {
  return Array.from(select.options)
    .filter((option) => option.value.trim() || option.textContent?.trim())
    .map((option) => ({
      value: option.value,
      label: option.textContent?.replace(/\s+/g, " ").trim() ?? option.value,
    }));
}

export function resolveControlId(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  label: string,
  index: number,
): string {
  if (element.id) return element.id;
  if (element.name) return element.name;

  const dataQa = element.getAttribute("data-qa");
  if (dataQa) return dataQa;

  const automationId = element.getAttribute("data-automation-id");
  if (automationId) return automationId;

  return `field-${index}-${label.slice(0, 24).replace(/\s+/g, "-").toLowerCase()}`;
}

export function labelFromForAttribute(element: HTMLElement): string | null {
  const id = element.getAttribute("id");
  if (!id) return null;
  const label = element.ownerDocument.querySelector(`label[for="${CSS.escape(id)}"]`);
  return label?.textContent?.replace(/\s+/g, " ").trim() ?? null;
}

export function labelFromAria(element: HTMLElement): string | null {
  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy) {
    const labelEl = element.ownerDocument.getElementById(labelledBy);
    if (labelEl?.textContent) return labelEl.textContent.replace(/\s+/g, " ").trim();
  }

  const aria = element.getAttribute("aria-label");
  if (aria) return aria.trim();

  return null;
}

export function labelFromPlaceholder(
  element: HTMLInputElement | HTMLTextAreaElement,
): string | null {
  const placeholder = element.getAttribute("placeholder");
  return placeholder?.trim() ?? null;
}

export function resolveControlLabel(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  explicitLabel?: string | null,
): string {
  if (explicitLabel?.trim()) return explicitLabel.replace(/\s+/g, " ").trim();

  return (
    labelFromForAttribute(element) ??
    labelFromAria(element) ??
    (isTextLikeInput(element) ? labelFromPlaceholder(element) : null) ??
    element.getAttribute("name") ??
    element.getAttribute("data-automation-id") ??
    "Unknown field"
  );
}

export function resolveFieldLabel(
  element: HTMLInputElement | HTMLTextAreaElement,
  explicitLabel?: string | null,
): string {
  return resolveControlLabel(element, explicitLabel);
}

export function toFormField(
  element: HTMLInputElement | HTMLTextAreaElement,
  label: string,
  index: number,
): FormField {
  return {
    id: resolveControlId(element, label, index),
    label,
    type: getInputType(element),
    required: element.required,
    maxLength: "maxLength" in element && element.maxLength > 0 ? element.maxLength : undefined,
    currentValue: element.value,
  };
}

export function toSelectFormField(
  element: HTMLSelectElement,
  label: string,
  index: number,
): FormField {
  return {
    id: resolveControlId(element, label, index),
    label,
    type: "select",
    required: element.required,
    currentValue: element.value,
    options: getSelectOptions(element),
  };
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function applySelectValue(select: HTMLSelectElement, desired: string): boolean {
  const target = normalize(desired);
  if (!target) return false;

  let bestIndex = -1;
  let bestScore = 0;

  Array.from(select.options).forEach((option, index) => {
    const label = normalize(option.textContent ?? "");
    const value = normalize(option.value);
    let score = 0;

    if (label === target || value === target) score = 100;
    else if (label.includes(target) || target.includes(label)) score = 80;
    else if (value.includes(target) || target.includes(value)) score = 70;

    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  if (bestIndex < 0 || bestScore < 40) return false;

  select.selectedIndex = bestIndex;
  select.dispatchEvent(new Event("input", { bubbles: true }));
  select.dispatchEvent(new Event("change", { bubbles: true }));
  select.dispatchEvent(new Event("blur", { bubbles: true }));
  return true;
}

export function resolveElementByStrategies(
  document: Document,
  id: string,
  label?: string,
): HTMLElement | null {
  const byId = document.getElementById(id);
  if (byId && isFormControl(byId)) return byId;

  const byName = document.querySelector(
    `input[name="${CSS.escape(id)}"], textarea[name="${CSS.escape(id)}"], select[name="${CSS.escape(id)}"]`,
  );
  if (byName && isFormControl(byName as HTMLElement)) return byName as HTMLElement;

  const byAutomation = document.querySelector(
    `[data-automation-id="${CSS.escape(id)}"]`,
  ) as HTMLElement | null;
  if (byAutomation && isFormControl(byAutomation)) return byAutomation;
  if (byAutomation) {
    const nested = byAutomation.querySelector("input, textarea, select");
    if (nested && isFormControl(nested as HTMLElement)) return nested as HTMLElement;
  }

  const byDataQa = document.querySelector(
    `[data-qa="${CSS.escape(id)}"], [data-qa="${CSS.escape(id)}"] input, [data-qa="${CSS.escape(id)}"] textarea, [data-qa="${CSS.escape(id)}"] select, input[data-qa="${CSS.escape(id)}"], textarea[data-qa="${CSS.escape(id)}"], select[data-qa="${CSS.escape(id)}"]`,
  ) as HTMLElement | null;
  if (byDataQa && isFormControl(byDataQa)) return byDataQa;
  if (byDataQa) {
    const nested = byDataQa.querySelector("input, textarea, select");
    if (nested && isFormControl(nested as HTMLElement)) return nested as HTMLElement;
  }

  if (label) {
    const normalized = label.trim().toLowerCase();
    const labels = Array.from(document.querySelectorAll("label"));
    for (const candidate of labels) {
      const text = candidate.textContent?.replace(/\s+/g, " ").trim().toLowerCase();
      if (!text || !text.includes(normalized.slice(0, 20))) continue;
      const control = candidate.control;
      if (control && isFormControl(control as HTMLElement)) {
        return control as HTMLElement;
      }
    }
  }

  return null;
}

export function dedupeFields(fields: FormField[]): FormField[] {
  const seen = new Set<string>();
  const result: FormField[] = [];

  for (const field of fields) {
    const key = `${field.id}::${field.label}::${field.type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(field);
  }

  return result;
}

export function collectControlsFromRoots(
  roots: Element[],
  getLabel: (root: Element, control: HTMLElement) => string,
  shouldSkipRoot?: (root: Element) => boolean,
): FormField[] {
  const fields: FormField[] = [];

  for (const root of roots) {
    if (shouldSkipRoot?.(root)) continue;

    const select = root.querySelector("select");
    if (select && !shouldSkipSelect(select)) {
      fields.push(toSelectFormField(select, getLabel(root, select), fields.length));
      continue;
    }

    const input = root.querySelector("input, textarea");
    if (!input || !isTextLikeInput(input as HTMLElement)) continue;
    if (isComboboxTrigger(input as HTMLElement)) continue;
    if (shouldSkipInput(input as HTMLInputElement | HTMLTextAreaElement)) continue;

    fields.push(
      toFormField(
        input as HTMLInputElement | HTMLTextAreaElement,
        getLabel(root, input as HTMLElement),
        fields.length,
      ),
    );
  }

  return fields;
}
