import { config } from "./config.js";

function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

function splitSentences(text) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);
}

export function chunkText(text) {
  const sentences = splitSentences(text);
  const chunks = [];
  let current = [];
  let currentTokens = 0;
  let index = 0;

  for (const sentence of sentences) {
    const tokens = estimateTokens(sentence);

    if (currentTokens + tokens > config.rag.chunkTokens && current.length > 0) {
      chunks.push({ text: current.join(" "), index: index++ });

      // Build overlap from tail of current chunk
      const overlap = [];
      let overlapTokens = 0;
      for (let i = current.length - 1; i >= 0; i--) {
        const t = estimateTokens(current[i]);
        if (overlapTokens + t > config.rag.chunkOverlap) break;
        overlap.unshift(current[i]);
        overlapTokens += t;
      }

      current = overlap;
      currentTokens = overlapTokens;
    }

    current.push(sentence);
    currentTokens += tokens;
  }

  if (current.length > 0) {
    chunks.push({ text: current.join(" "), index: index });
  }

  return chunks;
}
