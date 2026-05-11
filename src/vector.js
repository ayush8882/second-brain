import { QdrantClient } from "@qdrant/js-client-rest";
import { config } from "./config.js";

const client = new QdrantClient({
  url: config.qdrantUrl,
  apiKey: config.qdrantApiKey,
});

// Create collection if it doesn't exist — run on startup
export async function ensureCollection() {
  const { collections } = await client.getCollections();
  const exists = collections.some((c) => c.name === config.collection);

  if (!exists) {
    await client.createCollection(config.collection, {
      vectors: {
        size: config.vectorSize,
        distance: "Cosine",
      },
    });
    console.log(`✓ Qdrant collection '${config.collection}' created`);
  }
}

// Store chunks for a note
export async function upsertChunks(chunks) {
  if (chunks.length === 0) return;

  await client.upsert(config.collection, {
    points: chunks.map((chunk) => ({
      id: chunk.id,
      vector: chunk.vector,
      payload: {
        noteId: chunk.noteId,
        text: chunk.text,
        chunkIndex: chunk.chunkIndex,
        sourceType: chunk.sourceType,
        title: chunk.title,
        sourceRef: chunk.sourceRef,
      },
    })),
  });
}

// Search — the core operation
export async function search(queryVector, topK = config.rag.topK) {
  const results = await client.search(config.collection, {
    vector: queryVector,
    limit: topK,
    with_payload: true,
    score_threshold: config.rag.scoreThreshold,
  });

  return results.map((r) => ({
    text: r.payload.text,
    noteId: r.payload.noteId,
    title: r.payload.title,
    sourceType: r.payload.sourceType,
    sourceRef: r.payload.sourceRef,
    score: r.score,
  }));
}

// Delete all chunks belonging to a note
export async function deleteNoteChunks(noteId) {
  await client.delete(config.collection, {
    filter: {
      must: [{ key: "noteId", match: { value: noteId } }],
    },
  });
}
