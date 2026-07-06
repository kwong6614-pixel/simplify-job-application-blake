export const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

export function getOpenAiModel(): string {
  const configured = process.env.OPENAI_MODEL?.trim();
  return configured || DEFAULT_OPENAI_MODEL;
}

/** gpt-5 and o-series models only accept the provider default temperature. */
export function modelSupportsCustomTemperature(model: string): boolean {
  const normalized = model.toLowerCase();
  if (normalized.startsWith("gpt-5")) return false;
  if (normalized.startsWith("o1")) return false;
  if (normalized.startsWith("o3")) return false;
  return true;
}

export function chatTemperatureOption(
  model: string,
  temperature: number,
): { temperature?: number } {
  if (!modelSupportsCustomTemperature(model)) {
    return {};
  }
  return { temperature };
}
