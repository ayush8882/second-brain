import readline from "node:readline";
import { ensureCollection } from "./vector.js";
import { ingest } from "./ingest.js";
import { ask } from "./chat.js";
import { notesDb } from "./db.js";

await ensureCollection();

const SESSION_ID = "cli-session-" + Date.now();
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
const prompt = (q) => new Promise((resolve) => rl.question(q, resolve));

console.log("\n🧠 Second Brain — Personal Knowledge OS");
console.log(
  "Commands: ask | ingest-text | ingest-pdf | ingest-url | list | exit\n",
);

while (true) {
  const command = (await prompt("> ")).trim().toLowerCase();

  if (command === "exit") {
    console.log("Goodbye.");
    rl.close();
    process.exit(0);
  }

  if (command === "list") {
    const notes = notesDb.getAll.all();
    if (notes.length === 0) {
      console.log(
        "No notes yet. Use ingest-text, ingest-pdf, or ingest-url.\n",
      );
    } else {
      console.log("\nYour knowledge base:");
      notes.forEach((n, i) => {
        console.log(
          `  ${i + 1}. [${n.source_type}] ${n.title} — ${n.chunk_count} chunks (${n.created_at})`,
        );
      });
      console.log("");
    }
    continue;
  }

  if (command === "ingest-text") {
    const title = await prompt("Title: ");
    console.log(
      "Paste your text (press Enter then type END on a new line when done):",
    );
    let text = "";
    while (true) {
      const line = await prompt("");
      if (line.trim() === "END") break;
      text += line + "\n";
    }
    await ingest({ sourceType: "text", input: text, title });
    continue;
  }

  if (command === "ingest-pdf") {
    const title = await prompt("Title: ");
    const filePath = await prompt("PDF file path: ");
    await ingest({ sourceType: "pdf", input: filePath.trim(), title });
    continue;
  }

  if (command === "ingest-url") {
    const url = await prompt("URL: ");
    const title = await prompt("Title (or press Enter to use page title): ");
    await ingest({ sourceType: "url", input: url.trim(), title: title || url });
    continue;
  }

  if (command === "ask") {
    const question = await prompt("Question: ");
    await ask(SESSION_ID, question);
    continue;
  }

  console.log(
    "Unknown command. Try: ask | ingest-text | ingest-pdf | ingest-url | list | exit\n",
  );
}
