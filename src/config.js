import dotenv from "dotenv";
dotenv.config();

function numEnv(key, fallback) {
  const v = Number.parseFloat(process.env[key] ?? "");
  return Number.isFinite(v) ? v : fallback;
}

function intEnv(key, fallback) {
  const v = Number.parseInt(process.env[key] ?? "", 10);
  return Number.isFinite(v) ? v : fallback;
}

export const config = {
  anthropicKey: process.env.ANTHROPIC_API_KEY,
  voyageKey: process.env.VOYAGE_API_KEY,
  qdrantUrl: process.env.QDRANT_URL || "http://localhost:6333",
  qdrantApiKey: process.env.QDRANT_API_KEY,

  // Models — haiku for cheap tasks, sonnet for user-facing answers
  models: {
    chat: "claude-sonnet-4-20250514",
    agent: "claude-haiku-4-5-20251001", // connections agent — cheap
  },

  // RAG defaults from your bootcamp
  rag: {
    chunkTokens: 400,
    chunkOverlap: 50,
    topK: intEnv("RAG_TOP_K", 5),
    // Cosine scores for paraphrased Q vs chunks are often ~0.35–0.65; 0.75 filtered almost everything.
    scoreThreshold: numEnv("RAG_SCORE_THRESHOLD", 0.38),
  },

  collection: "second_brain",
  vectorSize: 1024, // voyage-3 dimension

  // Voyage without a payment method: 3 RPM + 10K TPM (aggregate). Throttle embeds to stay under both.
  voyageFreeTier: process.env.VOYAGE_FREE_TIER !== "false",
};
