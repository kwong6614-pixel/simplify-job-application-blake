export async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdfParseModule = await import("pdf-parse");
  const pdfParse =
    typeof pdfParseModule === "function"
      ? pdfParseModule
      : (pdfParseModule as { default?: (input: Buffer) => Promise<{ text?: string }> }).default;

  if (!pdfParse) {
    throw new Error("PDF parser is unavailable");
  }

  const result = await pdfParse(buffer);
  const text = result.text?.trim() ?? "";

  if (text.length < 50) {
    throw new Error(
      "Could not extract enough text from the PDF. Use a text-based PDF, not a scanned image.",
    );
  }

  return text;
}
