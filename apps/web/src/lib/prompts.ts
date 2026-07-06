import { readFileSync } from "fs";
import { join } from "path";

let cachedPrompt: string | null = null;

export function getApplicationFillPrompt(): string {
  if (cachedPrompt) return cachedPrompt;

  const promptPath = join(process.cwd(), "..", "..", "prompts", "application-fill.md");
  cachedPrompt = readFileSync(promptPath, "utf-8");
  return cachedPrompt;
}
