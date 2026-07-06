export const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

export function getOpenAiModel(): string {
  const configured = process.env.OPENAI_MODEL?.trim();
  return configured || DEFAULT_OPENAI_MODEL;
}
