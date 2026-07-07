import type { FormField } from "../../shared/messages";
import { collectComboboxFieldsInRoot, isComboboxTrigger, resolveComboboxTrigger } from "./combobox";
import type { AtsAdapter } from "./shared";
import {
  collectRadioGroupsFromRoot,
  dedupeFields,
  getQuestionLabelFromRoot,
  isTextLikeInput,
  resolveElementByStrategies,
  shouldSkipInput,
  shouldSkipSelect,
  toFormField,
  toSelectFormField,
} from "./shared";

const FORM_SELECTORS = [
  "form",
  "main",
  "[class*='Application']",
  "[class*='application']",
].join(", ");

const FIELD_ROOT_SELECTORS = [
  "fieldset",
  "[class*='Field']",
  "[class*='field']",
  "[class*='Question']",
  "[class*='question']",
  "[data-testid*='field']",
  "li",
].join(", ");

const SKIP_CONTAINERS = [
  'input[type="file"]',
  "[class*='resume']",
  "[class*='Resume']",
  "[class*='file-upload']",
  "[class*='FileUpload']",
].join(", ");

const RIPPLING_COMBOBOX_SELECTORS = [
  '[role="combobox"]',
  'button[aria-haspopup="listbox"]',
  'input[aria-haspopup="listbox"]',
];

function getRipplingFieldRoot(element: Element): Element {
  return (
    element.closest(FIELD_ROOT_SELECTORS) ??
    element.closest("div[class*='Form']") ??
    element.parentElement ??
    element
  );
}

function getRipplingLabel(fieldRoot: Element, control: HTMLElement): string {
  return getQuestionLabelFromRoot(fieldRoot, control);
}

function shouldSkipRoot(root: Element): boolean {
  return Boolean(root.querySelector(SKIP_CONTAINERS) || root.closest(SKIP_CONTAINERS));
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
    fields.push(toSelectFormField(select, getRipplingLabel(fieldRoot, select), fields.length));
    return;
  }

  if (!isTextLikeInput(control)) return;
  const input = control as HTMLInputElement | HTMLTextAreaElement;
  if (shouldSkipInput(input)) return;
  fields.push(toFormField(input, getRipplingLabel(fieldRoot, input), fields.length));
}

export const ripplingAdapter: AtsAdapter = {
  id: "rippling",

  matches(hostname, url) {
    return hostname.includes("rippling.com") || url.includes("ats.rippling.com");
  },

  async collectFields(document) {
    const form =
      document.querySelector("form") ??
      document.querySelector("main") ??
      document.body;

    const fields: FormField[] = [];
    const fieldRoots = Array.from(form.querySelectorAll(FIELD_ROOT_SELECTORS));

    for (const fieldRoot of fieldRoots) {
      if (shouldSkipRoot(fieldRoot)) continue;
      for (const control of fieldRoot.querySelectorAll("input, textarea, select")) {
        const element = control as HTMLElement;
        if (element.getAttribute("type") === "radio") continue;
        collectControl(fields, fieldRoot, element);
      }
    }

    for (const control of form.querySelectorAll("input, textarea, select")) {
      const element = control as HTMLElement;
      if (element.getAttribute("type") === "radio") continue;
      if (element.closest(SKIP_CONTAINERS)) continue;
      collectControl(fields, getRipplingFieldRoot(element), element);
    }

    const radios = collectRadioGroupsFromRoot(form, getRipplingLabel, shouldSkipRoot);

    const comboboxes = await collectComboboxFieldsInRoot(
      document,
      form,
      "rippling",
      getRipplingLabel,
      RIPPLING_COMBOBOX_SELECTORS,
      { probeOptions: true },
    );

    return dedupeFields([...fields, ...radios, ...comboboxes]);
  },

  resolveElement(id, label) {
    const fromShared = resolveElementByStrategies(document, id, label);
    if (fromShared) return fromShared;
    return resolveComboboxTrigger(document, id);
  },
};
