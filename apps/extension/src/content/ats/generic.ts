import type { FormField } from "../../shared/messages";
import type { AtsAdapter } from "./shared";
import {
  dedupeFields,
  resolveControlLabel,
  resolveElementByStrategies,
  shouldSkipInput,
  shouldSkipSelect,
  toFormField,
  toSelectFormField,
} from "./shared";

const TEXT_INPUT_SELECTOR =
  'input[type="text"], input[type="email"], input[type="tel"], input[type="url"], input[type="number"], input:not([type]), textarea, select';

export const genericAdapter: AtsAdapter = {
  id: "generic",

  matches() {
    return true;
  },

  collectFields(document) {
    const elements = Array.from(document.querySelectorAll<HTMLElement>(TEXT_INPUT_SELECTOR));
    const fields: FormField[] = [];

    for (const element of elements) {
      if (element.tagName.toLowerCase() === "select") {
        const select = element as HTMLSelectElement;
        if (shouldSkipSelect(select)) continue;
        fields.push(
          toSelectFormField(select, resolveControlLabel(select), fields.length),
        );
        continue;
      }

      const input = element as HTMLInputElement | HTMLTextAreaElement;
      if (shouldSkipInput(input)) continue;
      fields.push(toFormField(input, resolveControlLabel(input), fields.length));
    }

    return dedupeFields(fields);
  },

  resolveElement(id, label) {
    return resolveElementByStrategies(document, id, label);
  },
};
