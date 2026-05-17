import { join } from 'node:path';

function numEnv(key: string, fallback: number): number {
  const v = Number.parseFloat(process.env[key] ?? '');
  return Number.isFinite(v) ? v : fallback;
}

function intEnv(key: string, fallback: number): number {
  const v = Number.parseInt(process.env[key] ?? '', 10);
  return Number.isFinite(v) ? v : fallback;
}

const voyageFreeTier = process.env.VOYAGE_FREE_TIER !== 'false';

/** Writable uploads directory for PDF multipart ingest (override with INGEST_FILES_ROOT). */
const defaultIngestRoot = join(process.cwd(), 'data', 'uploads');

export const config = {
  port: Number(process.env.PORT) || 3000,

  anthropicKey: process.env.ANTHROPIC_API_KEY,
  voyageKey: process.env.VOYAGE_API_KEY,
  qdrantUrl: process.env.QDRANT_URL ?? 'http://localhost:6333',
  qdrantApiKey: process.env.QDRANT_API_KEY,

  models: {
    chat: 'claude-sonnet-4-20250514',
    agent: 'claude-haiku-4-5-20251001',
    /** Free tier: smaller, cheaper model (512-d). Paid: voyage-3 (1024-d). */
    voyage: voyageFreeTier ? 'voyage-3-lite' : 'voyage-3',
  },

  /** Mirrors top-level `src/config.js` (CLI). */
  rag: {
    chunkTokens: 400,
    chunkOverlap: 50,
    topK: intEnv('RAG_TOP_K', 5),
    /** Cosine in Qdrant; paraphrased Q↔chunk pairs often sit ~0.35–0.65. */
    scoreThreshold: numEnv('RAG_SCORE_THRESHOLD', 0.38),
  },

  collection: 'second_brain',
  /** Must match the chosen Voyage model output size. */
  vectorSize: voyageFreeTier ? 512 : 1024,

  voyageFreeTier,

  /** PDF ingest only allows paths under this directory. */
  ingestFilesRoot: process.env.INGEST_FILES_ROOT?.trim() || defaultIngestRoot,
  urlFetchTimeoutMs: Number(process.env.URL_FETCH_TIMEOUT_MS) || 30_000,

  deepgramApiKey: process.env.DEEPGRAM_API_KEY ?? '',
};
