import type { FormField } from "../../shared/messages";
import { collectComboboxFieldsInRoot, isComboboxTrigger, resolveComboboxTrigger } from "./combobox";
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

const APPLICATION_ROOT_SELECTORS = [
  "[data-testid='job-application-form']",
  "[data-testid='application-form']",
  "[class*='JobApplication']",
  "[class*='ApplicationForm']",
  "[class*='application-form']",
  "form[action*='ashbyhq.com']",
  "form",
  "main",
];

const FIELD_CONTAINER_SELECTORS = [
  "[class*='FieldEntry']",
  "[class*='field-entry']",
  "[class*='QuestionContainer']",
  "[class*='applicationQuestion']",
  "[class*='FieldRow']",
  "[class*='fieldRow']",
  "fieldset",
  "[class*='field']",
  "[class*='Field']",
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
  '[class*="select"] [role="combobox"]',
  'input[aria-haspopup="listbox"]',
  'button[aria-haspopup="listbox"]',
  '[data-testid*="select"]',
  '[role="combobox"]',
];

export function isAshbyPage(document: Document, hostname: string, url: string): boolean {
  if (hostname.includes("ashbyhq.com") || url.includes("ashby_jid")) {
    return true;
  }

  for (const selector of APPLICATION_ROOT_SELECTORS) {
    if (document.querySelector(selector)) {
      return true;
    }
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
    fieldRoot.querySelector("[class*='label']") ??
    fieldRoot.querySelector("legend") ??
    fieldRoot.querySelector("h3, h4, p, span");

  if (labelEl?.textContent?.trim()) {
    const text = labelEl.textContent.replace(/\s+/g, " ").trim();
    if (text.length >= 2 && text.length <= 120) return text;
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

function findApplicationRoot(document: Document): Element {
  for (const selector of APPLICATION_ROOT_SELECTORS) {
    const element = document.querySelector(selector);
    if (element) return element;
  }

  return document.body;
}

function collectFromContainers(root: Element, fields: FormField[]): void {
  const containers = Array.from(root.querySelectorAll(FIELD_CONTAINER_SELECTORS));

  for (const container of containers) {
    if (container.closest(SKIP_CONTAINERS)) continue;

    const control = container.querySelector("input, textarea, select, [role='combobox']");
    if (!control) continue;

    collectControl(fields, container, control as HTMLElement);
  }
}

export const ashbyAdapter: AtsAdapter = {
  id: "ashby",

  matches(hostname, url) {
    return hostname.includes("ashbyhq.com") || url.includes("ashby_jid");
  },

  async collectFields(document) {
    const root = findApplicationRoot(document);
    const fields: FormField[] = [];

    collectFromContainers(root, fields);

    const candidates = Array.from(root.querySelectorAll("input, textarea, select, [role='combobox']"));
    for (const control of candidates) {
      if (control.closest(SKIP_CONTAINERS)) continue;

      const fieldRoot =
        control.closest(FIELD_CONTAINER_SELECTORS) ??
        control.parentElement ??
        control;

      collectControl(fields, fieldRoot, control as HTMLElement);
    }

    const comboboxes = await collectComboboxFieldsInRoot(
      document,
      root,
      "ashby",
      getAshbyLabel,
      ASHBY_COMBOBOX_SELECTORS,
    );

    return dedupeFields([...fields, ...comboboxes]);
  },

  resolveElement(id, label) {
    const fromShared = resolveElementByStrategies(document, id, label);
    if (fromShared) return fromShared;

    const combobox = resolveComboboxTrigger(document, id);
    if (combobox) return combobox;

    return null;
  },
};
