import { v4 as uuid } from "uuid";
import { embedBatch } from "./embed.js";
import { chunkText } from "./chunker.js";
import { upsertChunks } from "./vector.js";
import { notesDb } from "./db.js";
import { parseText } from "./parsers/text.js";
import { parsePdf } from "./parsers/pdf.js";
import { parseUrl } from "./parsers/url.js";

// Route to the right parser based on source type
async function extractText(sourceType, input) {
  switch (sourceType) {
    case "text":
      return parseText(input);
    case "pdf":
      return parsePdf(input); // input = file path
    case "url":
      return parseUrl(input); // input = URL string
    default:
      throw new Error(`Unknown source type: ${sourceType}`);
  }
}

// The full pipeline — one function call to ingest anything
export async function ingest({ sourceType, input, title, tags = [] }) {
  console.log(`\n⚙ Ingesting [${sourceType}]: ${title}`);

  // Step 1: Extract clean text
  const rawText = await extractText(sourceType, input);
  console.log(`  ✓ Extracted ${rawText.length} characters`);

  // Step 2: Chunk it
  const chunks = chunkText(rawText);
  console.log(`  ✓ Split into ${chunks.length} chunks`);

  // Step 3: Embed all chunks in one batch call (cheapest approach)
  const noteId = uuid();
  const texts = chunks.map((c) => c.text);
  const vectors = await embedBatch(texts);
  console.log(`  ✓ Embedded ${vectors.length} chunks via Voyage AI`);

  // Step 4: Upsert to Qdrant
  const points = chunks.map((chunk, i) => ({
    id: uuid(),
    noteId,
    vector: vectors[i],
    text: chunk.text,
    chunkIndex: chunk.index,
    sourceType,
    title,
    sourceRef: input,
  }));

  await upsertChunks(points);
  console.log(`  ✓ Stored in Qdrant`);

  // Step 5: Save metadata to SQLite
  notesDb.insert.run({
    id: noteId,
    title,
    source_type: sourceType,
    source_ref: typeof input === "string" ? input : input.toString(),
    raw_text: rawText,
    tags: JSON.stringify(tags),
    chunk_count: chunks.length,
  });
  console.log(`  ✓ Saved to SQLite`);
  console.log(`  ✓ Done. Note ID: ${noteId}`);

  return { noteId, chunkCount: chunks.length };
}
