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
  "form.spl-application-form",
  "form[data-test='application-form']",
  "form[data-test='apply-form']",
  "spl-application form",
  "main form",
  "form",
].join(", ");

const SKIP_CONTAINERS = [
  "[data-test*='resume']",
  "[data-test*='file']",
  ".resume-upload",
  'input[type="file"]',
].join(", ");

function getSmartRecruitersLabel(fieldRoot: Element, control: HTMLElement): string {
  const labelEl =
    fieldRoot.querySelector("label, legend, .spl-form-field-label, h3, h4") ??
    fieldRoot.querySelector("[data-test*='label']");

  if (labelEl?.textContent?.trim()) {
    return labelEl.textContent.replace(/\s+/g, " ").trim();
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
  if (control.closest(SKIP_CONTAINERS)) return;

  if (control.tagName.toLowerCase() === "select") {
    const select = control as HTMLSelectElement;
    if (shouldSkipSelect(select)) return;
    fields.push(
      toSelectFormField(select, getSmartRecruitersLabel(fieldRoot, select), fields.length),
    );
    return;
  }

  if (!isTextLikeInput(control)) return;
  const input = control as HTMLInputElement | HTMLTextAreaElement;
  if (shouldSkipInput(input)) return;
  fields.push(toFormField(input, getSmartRecruitersLabel(fieldRoot, input), fields.length));
}

export const smartRecruitersAdapter: AtsAdapter = {
  id: "smartrecruiters",

  matches(hostname) {
    return hostname.includes("smartrecruiters.com");
  },

  collectFields(document) {
    const form = document.querySelector(FORM_SELECTORS);
    if (!form) return [];

    const fields: FormField[] = [];
    const fieldRoots = Array.from(
      form.querySelectorAll("spl-form-field, .spl-form-field, .field, .question, .form-field"),
    );

    for (const fieldRoot of fieldRoots) {
      const control = fieldRoot.querySelector("input, textarea, select");
      if (!control) continue;
      collectControl(fields, fieldRoot, control as HTMLElement);
    }

    const controls = Array.from(form.querySelectorAll("input, textarea, select"));
    for (const control of controls) {
      collectControl(
        fields,
        control.closest("spl-form-field, .spl-form-field, .field, div") ?? control,
        control as HTMLElement,
      );
    }

    return dedupeFields(fields);
  },

  resolveElement(id, label) {
    return resolveElementByStrategies(document, id, label);
  },
};
