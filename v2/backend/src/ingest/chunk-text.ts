import { config } from '../config/config';

/** Rough token→char estimate for English-ish text without a tokenizer. */
const CHARS_PER_TOKEN = 4;

export type TextChunk = { index: number; text: string };

export function chunkText(fullText: string): TextChunk[] {
  const trimmed = fullText.trim();
  if (!trimmed) {
    return [];
  }

  const maxChars = Math.max(
    64,
    Math.floor(config.rag.chunkTokens * CHARS_PER_TOKEN),
  );
  const overlapChars = Math.min(
    maxChars - 1,
    Math.floor(config.rag.chunkOverlap * CHARS_PER_TOKEN),
  );

  const chunks: TextChunk[] = [];
  let start = 0;
  let index = 0;

  while (start < trimmed.length) {
    const end = Math.min(trimmed.length, start + maxChars);
    const slice = trimmed.slice(start, end).trim();
    if (slice.length > 0) {
      chunks.push({ index, text: slice });
      index += 1;
    }
    if (end >= trimmed.length) {
      break;
    }
    start = Math.max(end - overlapChars, start + 1);
  }

  return chunks;
}
