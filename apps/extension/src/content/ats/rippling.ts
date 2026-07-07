import type { FormField } from "../../shared/messages";
import { collectComboboxFieldsInRoot, resolveComboboxTrigger } from "./combobox";
import type { AtsAdapter } from "./shared";
import {
  collectControlsFromRoots,
  collectRadioGroupsFromRoot,
  dedupeFields,
  getQuestionLabelFromRoot,
  resolveElementByStrategies,
} from "./shared";

const FORM_SELECTORS = "form, main";

const FIELD_ROOT_SELECTORS = [
  "[data-testid*='field']",
  "[class*='Question']",
  "[class*='question']",
  "fieldset",
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

function getRipplingLabel(fieldRoot: Element, control: HTMLElement): string {
  return getQuestionLabelFromRoot(fieldRoot, control);
}

function shouldSkipRoot(root: Element): boolean {
  return Boolean(root.querySelector(SKIP_CONTAINERS) || root.closest(SKIP_CONTAINERS));
}

export const ripplingAdapter: AtsAdapter = {
  id: "rippling",

  matches(hostname, url) {
    return hostname.includes("rippling.com") || url.includes("ats.rippling.com");
  },

  async collectFields(document) {
    const form =
      document.querySelector(FORM_SELECTORS) ??
      document.body;

    const fieldRoots = Array.from(form.querySelectorAll(FIELD_ROOT_SELECTORS));
    const fields = collectControlsFromRoots(fieldRoots, getRipplingLabel, shouldSkipRoot);

    const radios = collectRadioGroupsFromRoot(form, getRipplingLabel, shouldSkipRoot);

    const comboboxes = await collectComboboxFieldsInRoot(
      document,
      form,
      "rippling",
      getRipplingLabel,
      RIPPLING_COMBOBOX_SELECTORS,
    );

    return dedupeFields([...fields, ...radios, ...comboboxes]);
  },

  resolveElement(id, label) {
    const fromShared = resolveElementByStrategies(document, id, label);
    if (fromShared) return fromShared;
    return resolveComboboxTrigger(document, id);
  },
};
