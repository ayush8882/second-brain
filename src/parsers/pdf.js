import { PDFParse } from "pdf-parse";
import { readFileSync } from "node:fs";

export async function parsePdf(filePath) {
  const buffer = readFileSync(filePath);
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text.trim();
  } finally {
    await parser.destroy();
  }
}
