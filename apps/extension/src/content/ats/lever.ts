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

const FORM_SELECTORS = [
  "form.application-form",
  "form[data-qa='application-form']",
  "form[action*='/apply']",
  ".application-form form",
  ".postings-wrapper form",
].join(", ");

const LEVER_COMBOBOX_SELECTORS = [
  '[role="combobox"]',
  'input[aria-haspopup="listbox"]',
  'button[aria-haspopup="listbox"]',
  ".application-field .dropdown",
  "[data-qa*='dropdown']",
];

function getLeverFieldRoot(element: Element): Element {
  return (
    element.closest(
      ".application-field, .application-question, .posting-categories, [data-qa^='application-']",
    ) ?? element
  );
}

function getLeverLabel(fieldRoot: Element, control: HTMLElement): string {
  const explicit =
    fieldRoot.querySelector(".application-label, .text, label, h4, h5, legend") ??
    fieldRoot.querySelector("[data-qa*='label']");

  if (explicit?.textContent?.trim()) {
    return explicit.textContent.replace(/\s+/g, " ").trim();
  }

  const dataQa = control.getAttribute("data-qa");
  if (dataQa) return dataQa.replace(/-/g, " ");

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
    fields.push(toSelectFormField(select, getLeverLabel(fieldRoot, select), fields.length));
    return;
  }

  if (!isTextLikeInput(control)) return;
  const input = control as HTMLInputElement | HTMLTextAreaElement;
  if (shouldSkipInput(input)) return;
  fields.push(toFormField(input, getLeverLabel(fieldRoot, input), fields.length));
}

export const leverAdapter: AtsAdapter = {
  id: "lever",

  matches(hostname, url) {
    return (
      hostname.includes("lever.co") ||
      hostname.includes("jobs.lever.co") ||
      url.includes("lever.co/")
    );
  },

  async collectFields(document) {
    const form =
      document.querySelector(FORM_SELECTORS) ??
      document.querySelector("form.application-form") ??
      document.querySelector("form");

    if (!form) return [];

    const fields: FormField[] = [];
    const skipSelector =
      ".application-additional, .resume-upload, .cover-letter-upload, input[type='file']";

    for (const control of form.querySelectorAll("input, textarea, select, [role='combobox']")) {
      if (control.closest(skipSelector)) continue;
      collectControl(fields, getLeverFieldRoot(control), control as HTMLElement);
    }

    const customCards = Array.from(
      form.querySelectorAll(".application-question, .application-field, [data-qa^='application-']"),
    );
    for (const card of customCards) {
      if (card.closest(skipSelector)) continue;
      for (const control of card.querySelectorAll("input, textarea, select, [role='combobox']")) {
        collectControl(fields, card, control as HTMLElement);
      }
    }

    const comboboxes = await collectComboboxFieldsInRoot(
      document,
      form,
      "lever",
      getLeverLabel,
      LEVER_COMBOBOX_SELECTORS,
    );

    return dedupeFields([...fields, ...comboboxes]);
  },

  resolveElement(id, label) {
    const fromShared = resolveElementByStrategies(document, id, label);
    if (fromShared) return fromShared;
    return resolveComboboxTrigger(document, id);
  },
};
