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
  "section fieldset",
  "section [class*='field']",
  "section [class*='Field']",
  "[class*='Question']",
  "[class*='question']",
  "fieldset",
].join(", ");

const SKIP_CONTAINERS = [
  'input[type="file"]',
  "[class*='resume']",
  "[class*='Resume']",
  "[class*='upload']",
  "[class*='Upload']",
].join(", ");

function getGustoLabel(fieldRoot: Element, control: HTMLElement): string {
  return getQuestionLabelFromRoot(fieldRoot, control);
}

function shouldSkipRoot(root: Element): boolean {
  return Boolean(root.querySelector(SKIP_CONTAINERS) || root.closest(SKIP_CONTAINERS));
}

export const gustoAdapter: AtsAdapter = {
  id: "gusto",

  matches(hostname, url) {
    return hostname.includes("gusto.com") && (url.includes("/postings/") || url.includes("/applicants/"));
  },

  async collectFields(document) {
    const form =
      document.querySelector(FORM_SELECTORS) ??
      document.body;

    const fieldRoots = Array.from(form.querySelectorAll(FIELD_ROOT_SELECTORS));
    const fields = collectControlsFromRoots(fieldRoots, getGustoLabel, shouldSkipRoot);

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
