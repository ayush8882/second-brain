import type { VoyageAIClient } from 'voyageai';
import { config } from '../config/config';

/** Rough token estimate for Voyage rate limits (TPM). Mirrors `src/embed.js`. */
function estTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function httpStatus(e: unknown): number | undefined {
  if (e && typeof e === 'object') {
    const o = e as { statusCode?: number; status?: number };
    if (typeof o.statusCode === 'number') return o.statusCode;
    if (typeof o.status === 'number') return o.status;
  }
  return undefined;
}

/**
 * Single Voyage embed call with 429 backoff — same strategy as top-level `src/embed.js`.
 */
async function embedOneCall(
  client: VoyageAIClient,
  texts: string[],
): Promise<number[][]> {
  let attempt = 0;
  const maxAttempts = 5;
  while (true) {
    try {
      const response = await client.embed({
        input: texts,
        model: config.models.voyage,
      });
      const data = response.data ?? [];
      return data.map((d) => {
        const emb = d?.embedding;
        if (!emb?.length) {
          throw new Error('Voyage returned no embedding for one or more inputs.');
        }
        return emb;
      });
    } catch (e) {
      const status = httpStatus(e);
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

/** Split texts into batches under maxEstTokens (free-tier TPM spread). */
function chunkTextsForFreeTier(
  texts: string[],
  maxEstTokens: number,
): string[][] {
  const batches: string[][] = [];
  let cur: string[] = [];
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

export type EmbedBatchLog = (message: string) => void;

/**
 * Embed many strings; on free tier, shard + pace requests like `src/embed.js` embedBatch.
 */
export async function voyageEmbedBatch(
  client: VoyageAIClient,
  texts: string[],
  log?: EmbedBatchLog,
): Promise<number[][]> {
  if (texts.length === 0) return [];

  if (!config.voyageFreeTier) {
    return embedOneCall(client, texts);
  }

  const maxEstTokensPerBatch = 3000;
  const minMsBetweenCalls = 21_000;
  const batches = chunkTextsForFreeTier(texts, maxEstTokensPerBatch);
  if (batches.length > 1) {
    const paceSec = Math.round(
      ((batches.length - 1) * minMsBetweenCalls) / 1000,
    );
    log?.(
      `… Voyage free tier: ${batches.length} embedding requests (~${paceSec}s pacing for rate limits)`,
    );
  }
  const out: number[][] = [];
  for (let i = 0; i < batches.length; i++) {
    if (i > 0) await sleep(minMsBetweenCalls);
    const part = await embedOneCall(client, batches[i]);
    out.push(...part);
  }
  return out;
}

/** Single string → one vector (CLI `embed()`). */
export async function voyageEmbedOne(
  client: VoyageAIClient,
  text: string,
): Promise<number[]> {
  const vectors = await voyageEmbedBatch(client, [text]);
  const v = vectors[0];
  if (!v?.length) {
    throw new Error('Voyage returned no embedding.');
  }
  return v;
}
