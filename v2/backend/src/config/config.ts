

const voyageFreeTier = process.env.VOYAGE_FREE_TIER !== 'false';

export const config = {
  port: Number(process.env.PORT) || 3000,

  anthropicKey: process.env.ANTHROPIC_API_KEY,
  voyageKey: process.env.VOYAGE_API_KEY,
  qdrantUrl: process.env.QDRANT_URL ?? 'http://127.0.0.1:6333',
  qdrantApiKey: process.env.QDRANT_API_KEY,

  models: {
    chat: 'claude-sonnet-4-20250514',
    agent: 'claude-haiku-4-5-20251001',
    /** Free tier: smaller, cheaper model (512-d). Paid: voyage-3 (1024-d). */
    voyage: voyageFreeTier ? 'voyage-3-lite' : 'voyage-3',
  },

  rag: {
    chunkTokens: 400,
    chunkOverlap: 50,
    topK: 5,
    scoreThreshold: 0.75,
  },

  collection: 'second_brain',
  /** Must match the chosen Voyage model output size. */
  vectorSize: voyageFreeTier ? 512 : 1024,

  voyageFreeTier,

  /** PDF ingest only allows paths under this directory (set e.g. to your uploads folder). */
  ingestFilesRoot: process.env.INGEST_FILES_ROOT?.trim() ?? '',
  urlFetchTimeoutMs: Number(process.env.URL_FETCH_TIMEOUT_MS) || 30_000,
};
