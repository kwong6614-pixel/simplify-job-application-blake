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
  "form[action*='ashbyhq.com']",
  "form[action*='application']",
  "form[class*='Application']",
  "[data-testid='application-form'] form",
  "[class*='ApplicationForm'] form",
  "main form",
].join(", ");

const SKIP_CONTAINERS = [
  "[data-testid*='resume']",
  "[data-testid*='file']",
  "[class*='FileUpload']",
  "[class*='Resume']",
  "input[type='file']",
].join(", ");

const ASHBY_COMBOBOX_SELECTORS = [
  '[class*="Select"] [role="combobox"]',
  'input[aria-haspopup="listbox"]',
  'button[aria-haspopup="listbox"]',
  '[data-testid*="select"]',
];

export function isAshbyPage(document: Document, hostname: string, url: string): boolean {
  if (hostname.includes("ashbyhq.com") || url.includes("ashby_jid")) {
    return true;
  }

  if (document.querySelector(FORM_SELECTORS)) {
    return true;
  }

  if (document.querySelector('script[src*="ashbyhq.com"], a[href*="ashbyhq.com"]')) {
    return true;
  }

  return Boolean(
    document.querySelector(
      '[class*="ashby"], [data-testid*="ashby"], meta[property*="ashby"]',
    ),
  );
}

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

function findApplicationRoot(document: Document): Element | null {
  return (
    document.querySelector(FORM_SELECTORS) ??
    document.querySelector("form") ??
    document.querySelector("[data-testid='job-application-form']") ??
    document.querySelector("[class*='ApplicationForm']") ??
    document.querySelector("main")
  );
}

export const ashbyAdapter: AtsAdapter = {
  id: "ashby",

  matches(hostname, url) {
    return hostname.includes("ashbyhq.com") || url.includes("ashby_jid");
  },

  async collectFields(document) {
    const form = findApplicationRoot(document);
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
      form.querySelectorAll(
        "[class*='FieldEntry'], [class*='field-entry'], [class*='Question'], [class*='question']",
      ),
    );

    for (const group of groupedFields) {
      if (group.querySelector(SKIP_CONTAINERS)) continue;
      const control = group.querySelector("input, textarea, select");
      if (!control) continue;
      collectControl(fields, group, control as HTMLElement);
    }

    const comboboxes = await collectComboboxFieldsInRoot(
      document,
      form,
      "ashby",
      getAshbyLabel,
      ASHBY_COMBOBOX_SELECTORS,
    );

    return dedupeFields([...fields, ...comboboxes]);
  },

  resolveElement(id, label) {
    return resolveElementByStrategies(document, id, label);
  },
};
