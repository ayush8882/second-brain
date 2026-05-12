import { config } from '../config/config';

/** Mirrors `src/chunker.js` sentence-based chunking + overlap. */

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);
}

export type TextChunk = { index: number; text: string };

export function chunkText(text: string): TextChunk[] {
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }

  const sentences = splitSentences(trimmed);
  const chunks: TextChunk[] = [];
  let current: string[] = [];
  let currentTokens = 0;
  let index = 0;

  for (const sentence of sentences) {
    const tokens = estimateTokens(sentence);

    if (
      currentTokens + tokens > config.rag.chunkTokens &&
      current.length > 0
    ) {
      chunks.push({ text: current.join(' '), index: index++ });

      const overlap: string[] = [];
      let overlapTokens = 0;
      for (let i = current.length - 1; i >= 0; i--) {
        const t = estimateTokens(current[i] ?? '');
        if (overlapTokens + t > config.rag.chunkOverlap) break;
        overlap.unshift(current[i] ?? '');
        overlapTokens += t;
      }

      current = overlap;
      currentTokens = overlapTokens;
    }

    current.push(sentence);
    currentTokens += tokens;
  }

  if (current.length > 0) {
    chunks.push({ text: current.join(' '), index: index });
  }

  return chunks;
}
