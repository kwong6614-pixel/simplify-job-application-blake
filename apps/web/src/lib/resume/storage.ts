import { mkdir, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";

const MAX_BYTES = 5 * 1024 * 1024;

function getUploadDir(): string {
  if (process.env.UPLOAD_DIR?.trim()) {
    return process.env.UPLOAD_DIR.trim();
  }

  if (process.env.VERCEL) {
    return join(tmpdir(), "job-app-resumes");
  }

  return join(process.cwd(), "uploads", "resumes");
}

export async function saveResumePdf(
  userId: string,
  originalName: string,
  buffer: Buffer,
): Promise<{ storedName: string; storedPath: string | null }> {
  if (buffer.byteLength > MAX_BYTES) {
    throw new Error("Resume PDF must be 5 MB or smaller");
  }

  const storedName = `${userId}-${randomUUID()}.pdf`;

  if (process.env.VERCEL) {
    return { storedName, storedPath: null };
  }

  const uploadDir = getUploadDir();
  await mkdir(uploadDir, { recursive: true });

  const storedPath = join(uploadDir, storedName);
  await writeFile(storedPath, buffer);

  return {
    storedName,
    storedPath,
  };
}

export function sanitizeOriginalFileName(name: string): string {
  return name.replace(/[^\w.\-() ]+/g, "_").slice(0, 120) || "resume.pdf";
}
