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
  "form[data-testid='job-application-form']",
  "form[action*='application']",
  "form[class*='Application']",
  "main form",
].join(", ");

const SKIP_CONTAINERS = [
  "[data-testid*='resume']",
  "[data-testid*='file']",
  "[class*='FileUpload']",
  "[class*='Resume']",
].join(", ");

function getAshbyLabel(fieldRoot: Element, control: HTMLElement): string {
  const labelEl =
    fieldRoot.querySelector("label") ??
    fieldRoot.querySelector("[class*='Label']") ??
    fieldRoot.querySelector("p, span");

  if (labelEl?.textContent?.trim()) {
    const text = labelEl.textContent.replace(/\s+/g, " ").trim();
    if (text.length <= 120) return text;
  }

  return resolveControlLabel(
    control as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  );
}

function collectControl(
  fields: FormField[],
  fieldRoot: Element,
  control: HTMLElement,
): void {
  if (isComboboxTrigger(control)) return;

  if (control.tagName.toLowerCase() === "select") {
    const select = control as HTMLSelectElement;
    if (shouldSkipSelect(select)) return;
    fields.push(toSelectFormField(select, getAshbyLabel(fieldRoot, select), fields.length));
    return;
  }

  if (!isTextLikeInput(control)) return;
  const input = control as HTMLInputElement | HTMLTextAreaElement;
  if (shouldSkipInput(input)) return;
  fields.push(toFormField(input, getAshbyLabel(fieldRoot, input), fields.length));
}

async function collectComboboxFields(document: Document): Promise<FormField[]> {
  const form = document.querySelector(FORM_SELECTORS) ?? document.querySelector("form");
  if (!form) return [];

  return collectComboboxFieldsInRoot(document, form, "ashby", getAshbyLabel, [
    '[class*="Select"]',
    '[data-testid*="select"]',
  ]);
}

export const ashbyAdapter: AtsAdapter = {
  id: "ashby",

  matches(hostname, url) {
    return hostname.includes("ashbyhq.com") || url.includes("ashby_jid");
  },

  async collectFields(document) {
    const form = document.querySelector(FORM_SELECTORS) ?? document.querySelector("form");
    if (!form) return [];

    const fields: FormField[] = [];
    const candidates = Array.from(form.querySelectorAll("input, textarea, select"));

    for (const control of candidates) {
      if (control.closest(SKIP_CONTAINERS)) continue;

      const fieldRoot =
        control.closest("[class*='field'], [class*='Field'], [class*='question'], label") ??
        control.parentElement ??
        control;

      collectControl(fields, fieldRoot, control as HTMLElement);
    }

    const groupedFields = Array.from(
      form.querySelectorAll("[class*='FieldEntry'], [class*='field-entry'], [class*='Question']"),
    );

    for (const group of groupedFields) {
      if (group.querySelector(SKIP_CONTAINERS)) continue;
      const control = group.querySelector("input, textarea, select");
      if (!control) continue;
      collectControl(fields, group, control as HTMLElement);
    }

    const comboboxes = await collectComboboxFields(document);
    return dedupeFields([...fields, ...comboboxes]);
  },

  resolveElement(id, label) {
    return resolveElementByStrategies(document, id, label);
  },
};
