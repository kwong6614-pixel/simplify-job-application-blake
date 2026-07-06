import type { FormField } from "../../shared/messages";
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
].join(", ");

function getLeverFieldRoot(element: Element): Element {
  return element.closest(".application-field, .application-question, [data-qa^='application-']") ?? element;
}

function getLeverLabel(fieldRoot: Element, control: HTMLElement): string {
  const explicit =
    fieldRoot.querySelector(".application-label, .text, label, h4, h5") ??
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

  matches(hostname) {
    return hostname.includes("lever.co") || hostname.includes("jobs.lever.co");
  },

  collectFields(document) {
    const form =
      document.querySelector(FORM_SELECTORS) ??
      document.querySelector("form");

    if (!form) return [];

    const fields: FormField[] = [];
    const controls = Array.from(form.querySelectorAll("input, textarea, select"));

    for (const control of controls) {
      if (control.closest(".application-additional, .resume-upload, .cover-letter-upload")) {
        continue;
      }

      collectControl(fields, getLeverFieldRoot(control), control as HTMLElement);
    }

    const customCards = Array.from(form.querySelectorAll(".application-question"));
    for (const card of customCards) {
      const control = card.querySelector("input, textarea, select");
      if (!control) continue;
      collectControl(fields, card, control as HTMLElement);
    }

    return dedupeFields(fields);
  },

  resolveElement(id, label) {
    return resolveElementByStrategies(document, id, label);
  },
};
