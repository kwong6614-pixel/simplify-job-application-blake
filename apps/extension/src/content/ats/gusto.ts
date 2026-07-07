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
  "main form",
  "[class*='Application']",
  "[class*='application']",
  "main",
].join(", ");

const FIELD_ROOT_SELECTORS = [
  "section",
  "fieldset",
  "[class*='Field']",
  "[class*='field']",
  "[class*='Question']",
  "[class*='question']",
  "li",
  "div[class*='form']",
].join(", ");

const SKIP_CONTAINERS = [
  'input[type="file"]',
  "[class*='resume']",
  "[class*='Resume']",
  "[class*='upload']",
  "[class*='Upload']",
].join(", ");

function getGustoFieldRoot(element: Element): Element {
  return (
    element.closest(FIELD_ROOT_SELECTORS) ??
    element.closest("div[class*='Form']") ??
    element.parentElement ??
    element
  );
}

function getGustoLabel(fieldRoot: Element, control: HTMLElement): string {
  const sectionHeading = fieldRoot.closest("section")?.querySelector("h2, h3, h4");
  const fieldLabel = getQuestionLabelFromRoot(fieldRoot, control);
  const sectionText = sectionHeading?.textContent?.replace(/\s+/g, " ").trim();

  if (sectionText && fieldLabel !== sectionText && !fieldLabel.includes(sectionText)) {
    const normalizedField = fieldLabel.toLowerCase();
    const genericLabels = new Set([
      "first name",
      "middle name",
      "last name",
      "email",
      "phone",
      "unknown field",
    ]);
    if (!genericLabels.has(normalizedField)) {
      return fieldLabel;
    }
  }

  return fieldLabel;
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
    fields.push(toSelectFormField(select, getGustoLabel(fieldRoot, select), fields.length));
    return;
  }

  if (!isTextLikeInput(control)) return;
  const input = control as HTMLInputElement | HTMLTextAreaElement;
  if (shouldSkipInput(input)) return;
  fields.push(toFormField(input, getGustoLabel(fieldRoot, input), fields.length));
}

export const gustoAdapter: AtsAdapter = {
  id: "gusto",

  matches(hostname, url) {
    return hostname.includes("gusto.com") && (url.includes("/postings/") || url.includes("/applicants/"));
  },

  async collectFields(document) {
    const form =
      document.querySelector(FORM_SELECTORS) ??
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
      collectControl(fields, getGustoFieldRoot(element), element);
    }

    const radios = collectRadioGroupsFromRoot(form, getGustoLabel, shouldSkipRoot);

    const comboboxes = await collectComboboxFieldsInRoot(
      document,
      form,
      "gusto",
      getGustoLabel,
      ['[role="combobox"]', 'button[aria-haspopup="listbox"]', 'input[aria-haspopup="listbox"]'],
    );

    return dedupeFields([...fields, ...radios, ...comboboxes]);
  },

  resolveElement(id, label) {
    const fromShared = resolveElementByStrategies(document, id, label);
    if (fromShared) return fromShared;
    return resolveComboboxTrigger(document, id);
  },
};
