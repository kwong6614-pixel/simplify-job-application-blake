import type { FormField } from "../../shared/messages";
import { collectComboboxFieldsInRoot, isComboboxTrigger, resolveComboboxTrigger } from "./combobox";
import type { AtsAdapter } from "./shared";
import {
  collectRadioGroupsFromRoot,
  dedupeFields,
  getQuestionLabelFromRoot,
  isFormControl,
  isTextLikeInput,
  resolveElementByStrategies,
  shouldSkipInput,
  shouldSkipSelect,
  toFormField,
  toSelectFormField,
} from "./shared";

const FORM_SELECTORS = [
  "[data-ui='application-form']",
  "form[data-ui='apply-form']",
  "main form",
  "form",
].join(", ");

const FIELD_ROOT_SELECTORS = [
  "[data-ui='form-field']",
  ".form-field",
  "fieldset",
  "section",
  "li",
].join(", ");

const SKIP_CONTAINERS = [
  "[data-ui*='resume']",
  "[data-ui*='avatar']",
  "[data-ui*='file']",
  'input[type="file"]',
].join(", ");

function getWorkableFieldRoot(element: Element): Element {
  return (
    element.closest(FIELD_ROOT_SELECTORS) ??
    element.closest("div[class*='field']") ??
    element.parentElement ??
    element
  );
}

function getWorkableLabel(fieldRoot: Element, control: HTMLElement): string {
  const explicit = fieldRoot.querySelector(
    "[data-ui='form-field-label'], label, legend, h3, h4",
  );
  if (explicit?.textContent?.trim()) {
    return explicit.textContent.replace(/\s+/g, " ").trim();
  }
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
    fields.push(toSelectFormField(select, getWorkableLabel(fieldRoot, select), fields.length));
    return;
  }

  if (!isTextLikeInput(control)) return;
  const input = control as HTMLInputElement | HTMLTextAreaElement;
  if (shouldSkipInput(input)) return;
  fields.push(toFormField(input, getWorkableLabel(fieldRoot, input), fields.length));
}

export const workableAdapter: AtsAdapter = {
  id: "workable",

  matches(hostname, url) {
    return hostname.includes("workable.com") || url.includes("apply.workable.com");
  },

  async collectFields(document) {
    const form = document.querySelector(FORM_SELECTORS);
    if (!form) return [];

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
      collectControl(fields, getWorkableFieldRoot(element), element);
    }

    const radios = collectRadioGroupsFromRoot(
      form,
      (fieldRoot) => getQuestionLabelFromRoot(fieldRoot),
      shouldSkipRoot,
    );

    const comboboxes = await collectComboboxFieldsInRoot(
      document,
      form,
      "workable",
      getWorkableLabel,
      ['[role="combobox"]', 'button[aria-haspopup="listbox"]', 'input[aria-haspopup="listbox"]'],
    );

    return dedupeFields([...fields, ...radios, ...comboboxes]);
  },

  resolveElement(id, label) {
    const byId = document.getElementById(id);
    if (byId && isFormControl(byId as HTMLElement)) {
      return byId;
    }

    const fromShared = resolveElementByStrategies(document, id, label);
    if (fromShared) return fromShared;
    return resolveComboboxTrigger(document, id);
  },
};
