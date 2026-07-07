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

const LABEL_NOISE = /\s*(clear selection|add comment|optional)\s*$/i;

export function getQuestionLabelFromRoot(fieldRoot: Element, control?: HTMLElement): string {
  const labelSelectors = [
    "label",
    "legend",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "[data-ui='form-field-label']",
    "[class*='label']",
    "[class*='Label']",
    "[class*='question']",
    "[class*='Question']",
    "[class*='title']",
    "[class*='Title']",
  ].join(", ");

  let best = "";
  for (const candidate of fieldRoot.querySelectorAll(labelSelectors)) {
    if (control && candidate.contains(control) && candidate !== control) continue;
    const text = candidate.textContent?.replace(/\s+/g, " ").trim() ?? "";
    if (!text || text.length > 500) continue;
    if (text.length > best.length) best = text;
  }

  if (best) {
    return best.replace(LABEL_NOISE, "").trim();
  }

  if (control) {
    return resolveControlLabel(
      control as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
    );
  }

  return "Unknown field";
}

export function collectRadioGroupsFromRoot(
  root: Element,
  getLabel: (fieldRoot: Element, groupName: string) => string,
  shouldSkipRoot?: (root: Element) => boolean,
): FormField[] {
  const groups = new Map<string, HTMLInputElement[]>();

  for (const input of root.querySelectorAll('input[type="radio"]')) {
    const radio = input as HTMLInputElement;
    if (radio.disabled || !isVisible(radio)) continue;
    if (!radio.name) continue;

    const fieldRoot = radio.closest(
      "fieldset, [data-ui='form-field'], [class*='Field'], [class*='field'], [class*='Question'], [class*='question'], li, div",
    );
    if (fieldRoot && shouldSkipRoot?.(fieldRoot)) continue;

    const existing = groups.get(radio.name) ?? [];
    existing.push(radio);
    groups.set(radio.name, existing);
  }

  const fields: FormField[] = [];

  for (const [name, radios] of groups) {
    const fieldRoot =
      radios[0].closest(
        "fieldset, [data-ui='form-field'], [class*='Field'], [class*='field'], [class*='Question'], [class*='question'], li, div",
      ) ?? radios[0].parentElement ?? root;

    const options = radios.map((radio) => {
      const labelEl =
        radio.id
          ? root.ownerDocument.querySelector(`label[for="${CSS.escape(radio.id)}"]`)
          : null;
      const label =
        labelEl?.textContent?.replace(/\s+/g, " ").trim() ||
        radio.getAttribute("aria-label") ||
        radio.value;
      return { value: radio.value, label };
    });

    fields.push({
      id: name,
      label: getLabel(fieldRoot, name),
      type: "select",
      required: radios.some((radio) => radio.required),
      options,
      currentValue: radios.find((radio) => radio.checked)?.value,
    });
  }

  return fields;
}

export function applyRadioGroupValue(
  document: Document,
  groupName: string,
  desired: string,
  options?: FormFieldOption[],
): boolean {
  const radios = Array.from(
    document.querySelectorAll<HTMLInputElement>(
      `input[type="radio"][name="${CSS.escape(groupName)}"]`,
    ),
  ).filter((radio) => !radio.disabled && isVisible(radio));

  if (radios.length === 0) return false;

  const target = normalize(desired);
  let bestRadio: HTMLInputElement | null = null;
  let bestScore = 0;

  for (const radio of radios) {
    const labelEl = radio.id
      ? document.querySelector(`label[for="${CSS.escape(radio.id)}"]`)
      : null;
    const label = normalize(labelEl?.textContent ?? radio.getAttribute("aria-label") ?? "");
    const value = normalize(radio.value);
    let score = 0;

    if (label === target || value === target) score = 100;
    else if (label.includes(target) || target.includes(label)) score = 80;
    else if (value.includes(target) || target.includes(value)) score = 70;

    if (options?.length) {
      for (const option of options) {
        const optionLabel = normalize(option.label);
        const optionValue = normalize(option.value);
        if (optionLabel === target || optionValue === target) {
          if (label === optionLabel || value === optionValue) score = Math.max(score, 95);
        }
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestRadio = radio;
    }
  }

  if (!bestRadio || bestScore < 40) return false;

  bestRadio.click();
  bestRadio.dispatchEvent(new Event("input", { bubbles: true }));
  bestRadio.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

export function collectControlsFromRoots(
  roots: Element[],
  getLabel: (root: Element, control: HTMLElement) => string,
  shouldSkipRoot?: (root: Element) => boolean,
): FormField[] {
  const fields: FormField[] = [];

  for (const root of roots) {
    if (shouldSkipRoot?.(root)) continue;

    for (const select of root.querySelectorAll("select")) {
      if (shouldSkipSelect(select)) continue;
      fields.push(toSelectFormField(select, getLabel(root, select), fields.length));
    }

    for (const input of root.querySelectorAll("input, textarea")) {
      const element = input as HTMLElement;
      if (isComboboxTrigger(element)) continue;
      if (!isTextLikeInput(element)) continue;
      if (shouldSkipInput(element as HTMLInputElement | HTMLTextAreaElement)) continue;

      fields.push(
        toFormField(
          element as HTMLInputElement | HTMLTextAreaElement,
          getLabel(root, element),
          fields.length,
        ),
      );
    }
  }

  return fields;
}
