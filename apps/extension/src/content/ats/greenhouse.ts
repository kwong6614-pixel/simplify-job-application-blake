import type { FormField } from "../../shared/messages";
import type { AtsAdapter } from "./shared";
import {
  collectControlsFromRoots,
  dedupeFields,
  resolveControlLabel,
  resolveElementByStrategies,
  shouldSkipInput,
  shouldSkipSelect,
  toFormField,
  toSelectFormField,
} from "./shared";

const FORM_SELECTORS = [
  "#application_form",
  "form[action*='applications']",
  ".application--container form",
  "#job_application",
  "form.greenhouse",
].join(", ");

const SKIP_FIELD_SELECTORS = [
  "#resume",
  "#cover_letter",
  "input[type='file']",
  ".file-upload",
  ".attach-or-paste",
].join(", ");

function getGreenhouseLabel(fieldRoot: Element, control: HTMLElement): string {
  const labelEl =
    fieldRoot.querySelector("label") ??
    fieldRoot.querySelector(".label") ??
    fieldRoot.querySelector(".field-label");

  if (labelEl?.textContent?.trim()) {
    return labelEl.textContent.replace(/\s+/g, " ").trim();
  }

  return resolveControlLabel(
    control as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  );
}

function shouldSkipRoot(root: Element): boolean {
  return Boolean(root.querySelector(SKIP_FIELD_SELECTORS));
}

export const greenhouseAdapter: AtsAdapter = {
  id: "greenhouse",

  matches(hostname) {
    return hostname.includes("greenhouse.io");
  },

  collectFields(document) {
    const form =
      document.querySelector(FORM_SELECTORS) ??
      document.querySelector("main form") ??
      document.querySelector("form");

    if (!form) return [];

    const fieldRoots = Array.from(form.querySelectorAll(".field, .text, .select"));
    const fields = collectControlsFromRoots(fieldRoots, getGreenhouseLabel, shouldSkipRoot);

    if (fields.length > 0) return dedupeFields(fields);

    const fallbackControls = Array.from(form.querySelectorAll("input, textarea, select"));
    const fallbackFields: FormField[] = [];

    for (const control of fallbackControls) {
      if (control.closest(SKIP_FIELD_SELECTORS)) continue;

      if (control.tagName.toLowerCase() === "select") {
        const select = control as HTMLSelectElement;
        if (shouldSkipSelect(select)) continue;
        fallbackFields.push(
          toSelectFormField(select, getGreenhouseLabel(form, select), fallbackFields.length),
        );
        continue;
      }

      const input = control as HTMLInputElement | HTMLTextAreaElement;
      if (shouldSkipInput(input)) continue;
      fallbackFields.push(
        toFormField(input, resolveControlLabel(input), fallbackFields.length),
      );
    }

    return dedupeFields(fallbackFields);
  },

  resolveElement(id, label) {
    return resolveElementByStrategies(document, id, label);
  },
};
