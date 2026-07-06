import type { FormField, FormFieldOption } from "../../shared/messages";
import { registerCombobox } from "./combobox-registry";

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function scoreOption(option: FormFieldOption, desired: string): number {
  const target = normalize(desired);
  const label = normalize(option.label);
  const value = normalize(option.value);

  if (!target) return 0;
  if (label === target || value === target) return 100;
  if (label.includes(target) || target.includes(label)) return 80;
  if (value.includes(target) || target.includes(value)) return 70;

  const targetTokens = target.split(" ").filter(Boolean);
  const labelTokens = new Set(label.split(" ").filter(Boolean));
  const overlap = targetTokens.filter((token) => labelTokens.has(token)).length;
  return overlap > 0 ? 40 + overlap * 10 : 0;
}

export function pickBestOption(
  options: FormFieldOption[],
  desired: string,
): FormFieldOption | null {
  let best: FormFieldOption | null = null;
  let bestScore = 0;

  for (const option of options) {
    const score = scoreOption(option, desired);
    if (score > bestScore) {
      best = option;
      bestScore = score;
    }
  }

  return bestScore >= 40 ? best : null;
}

export function isComboboxTrigger(element: HTMLElement): boolean {
  if (element.tagName.toLowerCase() === "select") return false;

  const role = element.getAttribute("role");
  if (role === "combobox") return true;

  const popup = element.getAttribute("aria-haspopup");
  if (popup === "listbox" || popup === "true") return true;

  const automationId = element.getAttribute("data-automation-id") ?? "";
  if (/dropdown|selecthead|multiselect/i.test(automationId)) return true;

  if (element.closest('[data-automation-id*="Dropdown"]')) {
    return element.matches("button, input");
  }

  return false;
}

export function getComboboxDisplayValue(trigger: HTMLElement): string {
  if (trigger.tagName.toLowerCase() === "input") {
    return (trigger as HTMLInputElement).value.trim();
  }

  const selected =
    trigger.querySelector('[class*="singleValue"], [class*="value"], [class*="Value"]')
      ?.textContent ?? trigger.textContent;

  return selected?.replace(/\s+/g, " ").trim() ?? "";
}

export function resolveComboboxId(trigger: HTMLElement, label: string, index: number): string {
  if (trigger.id) return trigger.id;

  const automationId = trigger.getAttribute("data-automation-id");
  if (automationId) return automationId;

  const dataTestId = trigger.getAttribute("data-testid");
  if (dataTestId) return dataTestId;

  const name = trigger.getAttribute("name");
  if (name) return name;

  return `combobox-${index}-${label.slice(0, 24).replace(/\s+/g, "-").toLowerCase()}`;
}

function isVisible(el: HTMLElement): boolean {
  const style = window.getComputedStyle(el);
  return style.display !== "none" && style.visibility !== "hidden";
}

export function findVisibleListbox(document: Document): HTMLElement | null {
  const listboxes = Array.from(
    document.querySelectorAll<HTMLElement>(
      [
        '[role="listbox"]',
        '[data-automation-id="activeListContainer"]',
        '[data-automation-id="menuContent"]',
        "ul[aria-label]",
      ].join(", "),
    ),
  );

  for (const listbox of listboxes.reverse()) {
    if (!isVisible(listbox)) continue;
    if (listbox.getAttribute("aria-hidden") === "true") continue;
    if (listbox.querySelector('[role="option"], [data-automation-id="promptOption"], li')) {
      return listbox;
    }
  }

  return null;
}

export function scrapeListboxOptions(listbox: HTMLElement): FormFieldOption[] {
  const optionElements = Array.from(
    listbox.querySelectorAll<HTMLElement>(
      [
        '[role="option"]',
        '[data-automation-id="promptOption"]',
        '[data-automation-id*="option"]',
        "li[role='option']",
        "li",
      ].join(", "),
    ),
  );

  const options: FormFieldOption[] = [];
  const seen = new Set<string>();

  for (const element of optionElements) {
    if (!isVisible(element)) continue;

    const label = element.textContent?.replace(/\s+/g, " ").trim() ?? "";
    if (!label || label.length > 120) continue;

    const value =
      element.getAttribute("data-value") ??
      element.getAttribute("data-automation-id") ??
      label;

    const key = normalize(label);
    if (seen.has(key)) continue;
    seen.add(key);

    options.push({ value, label });
  }

  return options;
}

function dispatchMouse(el: HTMLElement): void {
  el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

export async function openCombobox(trigger: HTMLElement): Promise<void> {
  trigger.scrollIntoView({ block: "center", behavior: "instant" });
  trigger.focus();
  dispatchMouse(trigger);

  if (trigger.tagName.toLowerCase() === "input") {
    trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
  }
}

export async function closeCombobox(document: Document): Promise<void> {
  document.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
  );
  await sleep(100);
}

export async function readComboboxOptions(
  document: Document,
  trigger: HTMLElement,
): Promise<FormFieldOption[]> {
  await openCombobox(trigger);
  await sleep(200);

  const listbox = findVisibleListbox(document);
  if (!listbox) {
    await closeCombobox(document);
    return [];
  }

  const options = scrapeListboxOptions(listbox);
  await closeCombobox(document);
  await sleep(120);
  return options;
}

export async function applyComboboxValue(
  document: Document,
  trigger: HTMLElement,
  desired: string,
  knownOptions?: FormFieldOption[],
): Promise<boolean> {
  if (!desired.trim()) return false;

  await openCombobox(trigger);
  await sleep(220);

  let listbox = findVisibleListbox(document);
  let options = knownOptions?.length ? knownOptions : listbox ? scrapeListboxOptions(listbox) : [];

  let picked = pickBestOption(options, desired);

  if (!picked && trigger.tagName.toLowerCase() === "input") {
    const input = trigger as HTMLInputElement;
    input.value = desired;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await sleep(180);
    listbox = findVisibleListbox(document);
    if (listbox) {
      options = scrapeListboxOptions(listbox);
      picked = pickBestOption(options, desired);
    }
  }

  if (!picked) {
    await closeCombobox(document);
    return false;
  }

  if (!listbox) listbox = findVisibleListbox(document);

  const targetText = normalize(picked.label);
  const optionNodes = listbox
    ? Array.from(
        listbox.querySelectorAll<HTMLElement>(
          '[role="option"], [data-automation-id="promptOption"], li',
        ),
      )
    : [];

  const matchNode =
    optionNodes.find((node) => normalize(node.textContent ?? "") === targetText) ??
    optionNodes.find((node) => normalize(node.textContent ?? "").includes(targetText));

  if (matchNode) {
    dispatchMouse(matchNode);
    await sleep(150);
    return true;
  }

  await closeCombobox(document);
  return false;
}

export function findComboboxTriggers(
  root: Element,
  extraSelectors: string[] = [],
): HTMLElement[] {
  const selector = [
    '[role="combobox"]',
    'button[aria-haspopup="listbox"]',
    'input[aria-haspopup="listbox"]',
    '[data-automation-id*="Dropdown"] button',
    '[data-automation-id*="Dropdown"] input',
    '[data-automation-id*="selectHead"]',
    '[data-testid*="select"]',
    '[class*="Select"] [role="combobox"]',
    ...extraSelectors,
  ].join(", ");

  const elements = Array.from(root.querySelectorAll<HTMLElement>(selector));
  const triggers: HTMLElement[] = [];
  const seen = new Set<HTMLElement>();

  for (const element of elements) {
    if (!isVisible(element)) continue;
    if (element.closest('select, [data-automation-id*="resume"], [data-automation-id*="file"]')) {
      continue;
    }

    const trigger = resolveComboboxTriggerElement(element);
    if (seen.has(trigger)) continue;
    seen.add(trigger);
    triggers.push(trigger);
  }

  return triggers;
}

function resolveComboboxTriggerElement(element: HTMLElement): HTMLElement {
  if (element.matches('[role="combobox"], button, input')) return element;

  const nested = element.querySelector<HTMLElement>(
    '[role="combobox"], button[aria-haspopup], input[aria-haspopup]',
  );
  return nested ?? element;
}

export function resolveComboboxTrigger(document: Document, id: string): HTMLElement | null {
  const byAutomation = document.querySelector(
    `[data-automation-id="${CSS.escape(id)}"]`,
  ) as HTMLElement | null;
  if (byAutomation && isComboboxTrigger(byAutomation)) return byAutomation;

  const byId = document.getElementById(id);
  if (byId && isComboboxTrigger(byId)) return byId;

  const byTestId = document.querySelector(
    `[data-testid="${CSS.escape(id)}"]`,
  ) as HTMLElement | null;
  if (byTestId && isComboboxTrigger(byTestId)) return byTestId;

  const byRole = document.querySelector(
    `[role="combobox"][name="${CSS.escape(id)}"], [role="combobox"][id="${CSS.escape(id)}"]`,
  ) as HTMLElement | null;
  if (byRole) return byRole;

  return null;
}

function toComboboxFormField(
  trigger: HTMLElement,
  label: string,
  index: number,
  options: FormFieldOption[],
  platform: "workday" | "ashby" | "generic",
): FormField {
  const id = resolveComboboxId(trigger, label, index);
  registerCombobox({ id, trigger, platform });

  return {
    id,
    label,
    type: "combobox",
    required:
      trigger.getAttribute("aria-required") === "true" ||
      trigger.getAttribute("required") !== null,
    currentValue: getComboboxDisplayValue(trigger),
    options,
  };
}

export async function collectComboboxFieldsInRoot(
  document: Document,
  root: Element,
  platform: "workday" | "ashby",
  getLabel: (fieldRoot: Element, trigger: HTMLElement) => string,
  extraSelectors: string[] = [],
): Promise<FormField[]> {
  const triggers = findComboboxTriggers(root, extraSelectors);
  const fields: FormField[] = [];

  for (const trigger of triggers) {
    const fieldRoot =
      trigger.closest(
        [
          '[data-automation-id*="formField"]',
          '[data-automation-id*="field"]',
          "[class*='FieldEntry']",
          "[class*='field-entry']",
          "[class*='Question']",
          "[class*='field']",
        ].join(", "),
      ) ?? trigger.parentElement ?? trigger;

    const label = getLabel(fieldRoot, trigger);

    let options: FormFieldOption[] = [];
    try {
      options = await readComboboxOptions(document, trigger);
    } catch {
      options = [];
    }

    fields.push(toComboboxFormField(trigger, label, fields.length, options, platform));
  }

  return fields;
}
