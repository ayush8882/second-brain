import Anthropic from "@anthropic-ai/sdk";
import { embed } from "./embed.js";
import { search } from "./vector.js";
import { buildMessages, saveTurn } from "./memory.js";
import { config } from "./config.js";

const claude = new Anthropic({ apiKey: config.anthropicKey });

export async function ask(sessionId, question) {
  // Step 1: Embed the question
  const queryVector = await embed(question);

  // Step 2: Retrieve relevant chunks from Qdrant
  const chunks = await search(queryVector);

  // Step 3: Handle no context
  if (chunks.length === 0) {
    console.log("\n🤷 No relevant notes found for that question.");
    console.log("Try ingesting more content or rephrase your question.\n");
    return;
  }

  // Step 4: Show sources
  console.log("\n📚 Sources:");
  chunks.forEach((c, i) => {
    console.log(
      `  [${i + 1}] "${c.title}" (${c.sourceType}) — relevance: ${(c.score * 100).toFixed(0)}%`,
    );
  });
  console.log("");

  // Step 5: Build context block
  const context = chunks
    .map((c, i) => `[${i + 1}] From "${c.title}":\n${c.text}`)
    .join("\n\n---\n\n");

  // Step 6: Load conversation history
  const messages = buildMessages(sessionId, question);

  // Step 7: Stream Claude's answer
  console.log("💬 Answer:\n");
  let fullAnswer = "";

  const stream = claude.messages.stream({
    model: config.models.chat,
    max_tokens: 1024,
    system: `You are a personal knowledge assistant. 
The user is querying their own saved notes and knowledge base.
Answer ONLY from the provided context — never invent information.
Be specific — reference the source titles when relevant.
If the context doesn't fully answer the question, say so clearly.

CONTEXT FROM NOTES:
${context}`,
    messages,
  });

  // Print each token as it arrives
  for await (const chunk of stream) {
    if (
      chunk.type === "content_block_delta" &&
      chunk.delta.type === "text_delta"
    ) {
      process.stdout.write(chunk.delta.text);
      fullAnswer += chunk.delta.text;
    }
  }

  const final = await stream.finalMessage();
  console.log("\n");

  // Step 8: Save turn to memory
  saveTurn(sessionId, question, fullAnswer);

  // Show token usage so you can track costs
  console.log(
    `[tokens used: ${final.usage.input_tokens} in / ${final.usage.output_tokens} out]`,
  );
}
