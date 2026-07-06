import type { FormField, FormFieldOption } from "@app/shared";

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function scoreOption(option: FormFieldOption, desired: string): number {
  const desiredNorm = normalize(desired);
  const labelNorm = normalize(option.label);
  const valueNorm = normalize(option.value);

  if (!desiredNorm) return 0;
  if (labelNorm === desiredNorm || valueNorm === desiredNorm) return 100;
  if (labelNorm.includes(desiredNorm) || desiredNorm.includes(labelNorm)) return 80;
  if (valueNorm.includes(desiredNorm) || desiredNorm.includes(valueNorm)) return 70;

  const desiredTokens = desiredNorm.split(" ").filter(Boolean);
  const labelTokens = new Set(labelNorm.split(" ").filter(Boolean));
  const overlap = desiredTokens.filter((token) => labelTokens.has(token)).length;
  if (overlap > 0) return 40 + overlap * 10;

  return 0;
}

export function pickSelectOption(
  options: FormFieldOption[],
  desired: string,
): FormFieldOption | null {
  if (!desired.trim() || options.length === 0) return null;

  let best: FormFieldOption | null = null;
  let bestScore = 0;

  for (const option of options) {
    if (!option.label.trim() && !option.value.trim()) continue;
    const nextScore = scoreOption(option, desired);
    if (nextScore > bestScore) {
      best = option;
      bestScore = nextScore;
    }
  }

  return bestScore >= 40 ? best : null;
}

const WORK_AUTH_LABELS: Record<string, string[]> = {
  us_citizen: ["us citizen", "u s citizen", "citizen", "authorized to work", "yes"],
  permanent_resident: [
    "permanent resident",
    "green card",
    "lawful permanent resident",
    "lpr",
  ],
  visa_holder: ["visa", "h1b", "h-1b", "employment visa", "non citizen authorized"],
  other: ["other", "not authorized"],
};

const COUNTRY_LABELS: Record<string, string[]> = {
  US: ["united states", "usa", "u s a", "u s", "us"],
};

const DEGREE_ALIASES: Record<string, string[]> = {
  "high school": ["high school", "secondary", "ged"],
  associate: ["associate", "aa", "as degree"],
  bachelor: ["bachelor", "b s", "bs", "b a", "ba", "undergraduate"],
  master: ["master", "m s", "ms", "m a", "ma", "mba", "graduate"],
  doctorate: ["doctorate", "phd", "ph d", "doctoral"],
};

function expandDesiredValues(raw: string, aliases: Record<string, string[]>): string[] {
  const normalized = normalize(raw);
  const values = new Set<string>([raw]);

  for (const [key, options] of Object.entries(aliases)) {
    if (normalized.includes(normalize(key)) || options.some((item) => normalized.includes(normalize(item)))) {
      values.add(key);
      options.forEach((item) => values.add(item));
    }
  }

  return Array.from(values);
}

export function resolveSelectAnswer(field: FormField, desired: string): string {
  if (!field.options?.length) return desired;

  const haystack = normalize(`${field.label} ${field.id}`);
  let candidates = [desired];

  if (/work[\s_-]?authorization|eligible to work|legally authorized|visa|sponsor/i.test(haystack)) {
    candidates = expandDesiredValues(desired, WORK_AUTH_LABELS);
  } else if (/country|nation/i.test(haystack)) {
    candidates = expandDesiredValues(desired, COUNTRY_LABELS);
  } else if (/degree|education level|highest education/i.test(haystack)) {
    candidates = expandDesiredValues(desired, DEGREE_ALIASES);
  }

  for (const candidate of candidates) {
    const picked = pickSelectOption(field.options, candidate);
    if (picked) return picked.value || picked.label;
  }

  return desired;
}
