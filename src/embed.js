// src/embed.js
// voyageai's ESM build uses directory imports Node rejects; load CJS via createRequire.
import { createRequire } from "node:module";
import { config } from "./config.js";

const require = createRequire(import.meta.url);
const { VoyageAIClient } = require("voyageai");

const voyage = new VoyageAIClient({ apiKey: config.voyageKey });

const MODEL = "voyage-3";

/** Rough token estimate for Voyage rate limits (TPM). */
function estTokens(text) {
  return Math.ceil(text.length / 4);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function embedOneCall(texts) {
  let attempt = 0;
  const maxAttempts = 5;
  while (true) {
    try {
      const response = await voyage.embed({
        input: texts,
        model: MODEL,
      });
      return response.data.map((d) => d.embedding);
    } catch (e) {
      const status = e?.statusCode ?? e?.status;
      attempt += 1;
      if (status === 429 && attempt < maxAttempts) {
        const wait = Math.min(90_000, 15_000 * 2 ** (attempt - 1));
        await sleep(wait);
        continue;
      }
      throw e;
    }
  }
}

/** Split texts into batches so each stays under maxEstTokens (free-tier TPM spread across 3 RPM). */
function chunkTextsForFreeTier(texts, maxEstTokens) {
  const batches = [];
  let cur = [];
  let sum = 0;
  for (const t of texts) {
    const n = estTokens(t);
    if (cur.length && sum + n > maxEstTokens) {
      batches.push(cur);
      cur = [];
      sum = 0;
    }
    cur.push(t);
    sum += n;
  }
  if (cur.length) batches.push(cur);
  return batches;
}

// Embed a single string → returns 1024-dim vector
export async function embed(text) {
  const vectors = await embedOneCall([text]);
  return vectors[0];
}

// Embed many strings; on free tier, shards + spaces requests for 3 RPM / 10K TPM without billing.
export async function embedBatch(texts) {
  if (texts.length === 0) return [];

  if (!config.voyageFreeTier) {
    return embedOneCall(texts);
  }

  const maxEstTokensPerBatch = 3000;
  const minMsBetweenCalls = 21_000;
  const batches = chunkTextsForFreeTier(texts, maxEstTokensPerBatch);
  if (batches.length > 1) {
    const paceSec = Math.round(((batches.length - 1) * minMsBetweenCalls) / 1000);
    console.log(
      `  … Voyage free tier: ${batches.length} embedding requests (~${paceSec}s pacing for rate limits)`
    );
  }
  const out = [];
  for (let i = 0; i < batches.length; i++) {
    if (i > 0) await sleep(minMsBetweenCalls);
    const part = await embedOneCall(batches[i]);
    out.push(...part);
  }
  return out;
}
