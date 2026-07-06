import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

const UPLOAD_DIR = join(process.cwd(), "uploads", "resumes");
const MAX_BYTES = 5 * 1024 * 1024;

export async function saveResumePdf(
  userId: string,
  originalName: string,
  buffer: Buffer,
): Promise<{ storedName: string; storedPath: string }> {
  if (buffer.byteLength > MAX_BYTES) {
    throw new Error("Resume PDF must be 5 MB or smaller");
  }

  await mkdir(UPLOAD_DIR, { recursive: true });

  const storedName = `${userId}-${randomUUID()}.pdf`;
  const storedPath = join(UPLOAD_DIR, storedName);
  await writeFile(storedPath, buffer);

  return {
    storedName,
    storedPath,
  };
}

export function sanitizeOriginalFileName(name: string): string {
  return name.replace(/[^\w.\-() ]+/g, "_").slice(0, 120) || "resume.pdf";
}
