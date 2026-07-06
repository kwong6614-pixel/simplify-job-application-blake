import type { FormField } from "../../shared/messages";
import { collectComboboxFieldsInRoot, isComboboxTrigger } from "./combobox";
import type { AtsAdapter } from "./shared";
import {
  dedupeFields,
  isTextLikeInput,
  resolveControlLabel,
  resolveElementByStrategies,
  shouldSkipInput,
  shouldSkipSelect,
  toFormField,
  toSelectFormField,
} from "./shared";
const FORM_SELECTORS = [
  '[data-automation-id="jobApplicationForm"]',
  "form[data-automation-id*='apply']",
  "main form",
  "form",
].join(", ");

const SKIP_CONTAINERS = [
  '[data-automation-id*="resume"]',
  '[data-automation-id*="Resume"]',
  '[data-automation-id*="file"]',
  'input[type="file"]',
].join(", ");

function getWorkdayLabel(fieldRoot: Element, control: HTMLElement): string {
  const labelEl =
    fieldRoot.querySelector("label") ??
    fieldRoot.querySelector('[data-automation-id*="label"]') ??
    fieldRoot.querySelector("legend, span, p");

  if (labelEl?.textContent?.trim()) {
    return labelEl.textContent.replace(/\s+/g, " ").trim();
  }

  const automationId = control.getAttribute("data-automation-id");
  if (automationId) return automationId.replace(/([A-Z])/g, " $1").trim();

  return resolveControlLabel(
    control as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  );
}

function getFieldRoot(control: Element): Element {
  return (
    control.closest('[data-automation-id*="formField"], [data-automation-id*="field"]') ??
    control.closest("div") ??
    control
  );
}

function collectControl(
  fields: FormField[],
  fieldRoot: Element,
  control: HTMLElement,
): void {
  if (control.closest(SKIP_CONTAINERS)) return;
  if (isComboboxTrigger(control)) return;

  if (control.tagName.toLowerCase() === "select") {
    const select = control as HTMLSelectElement;
    if (shouldSkipSelect(select)) return;
    fields.push(toSelectFormField(select, getWorkdayLabel(fieldRoot, select), fields.length));
    return;
  }

  if (!isTextLikeInput(control)) return;
  const input = control as HTMLInputElement | HTMLTextAreaElement;
  if (shouldSkipInput(input)) return;
  fields.push(toFormField(input, getWorkdayLabel(fieldRoot, input), fields.length));
}

async function collectComboboxFields(document: Document): Promise<FormField[]> {
  const form = document.querySelector(FORM_SELECTORS);
  if (!form) return [];

  return collectComboboxFieldsInRoot(document, form, "workday", getWorkdayLabel, [
    '[data-automation-id*="dropdown"]',
    'button[aria-expanded="false"]',
  ]);
}

export const workdayAdapter: AtsAdapter = {
  id: "workday",

  matches(hostname) {
    return hostname.includes("myworkdayjobs.com") || hostname.includes("myworkday.com");
  },

  async collectFields(document) {
    const form = document.querySelector(FORM_SELECTORS);
    if (!form) return [];

    const fields: FormField[] = [];
    const controls = Array.from(form.querySelectorAll("input, textarea, select"));

    for (const control of controls) {
      collectControl(fields, getFieldRoot(control), control as HTMLElement);
    }

    const automationFields = Array.from(
      form.querySelectorAll('[data-automation-id*="formField"], [data-automation-id*="Dropdown"]'),
    );

    for (const fieldRoot of automationFields) {
      const control = fieldRoot.querySelector("input, textarea, select");
      if (!control) continue;
      collectControl(fields, fieldRoot, control as HTMLElement);
    }

    const comboboxes = await collectComboboxFields(document);
    return dedupeFields([...fields, ...comboboxes]);
  },

  resolveElement(id, label) {
    return resolveElementByStrategies(document, id, label);
  },
};
