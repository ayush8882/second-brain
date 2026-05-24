import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
dotenv.config();

const claude = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function getWritingSuggestions(editorContext) {
  const {
    currentText, // what the user has written so far
    cursorPosition, // where in the document they are
    documentTitle, // title of the document
    recentEdits, // last 3 things they changed
    userIntent, // optional: what the user is trying to do
  } = editorContext;

  const textBefore = currentText.slice(
    Math.max(0, cursorPosition - 500),
    cursorPosition,
  );

  const textAfter = currentText.slice(cursorPosition, cursorPosition + 200);

  const response = await claude.messages.create({
    model: "claude-haiku-4-5-20251001", // Haiku — copilots need speed
    max_tokens: 300,
    temperature: 0.7, // slight creativity for suggestions
    system: `You are a writing copilot embedded in a note-taking app.
            You have access to what the user is currently writing.
            Your job: offer 3 short, specific, actionable suggestions for what to write next.
            Be concrete — not generic advice like "add more detail".
            Each suggestion should be 1 sentence that could directly follow their text.
            Format: return exactly 3 suggestions as a JSON array of strings.
            No explanation, no preamble.`,
    messages: [
      {
        role: "user",
        content: `Document: "${documentTitle}"

            Text before cursor:
            ${textBefore}

            [CURSOR IS HERE]

            Text after cursor (if any):
            ${textAfter}

            Recent edits: ${recentEdits?.join(", ") || "none"}
            User intent: ${userIntent || "not specified"}

            Give 3 continuation suggestions:`,
      },
    ],
  });

  try {
    return JSON.parse(response.content[0].text);
  } catch {
    // fallback — extract array if wrapped in markdown
    const match = response.content[0].text.match(/\[[\s\S]*\]/);
    return match ? JSON.parse(match[0]) : [];
  }
}

const suggestions = await getWritingSuggestions({
  documentTitle: "System Design Interview Prep",
  currentText: `When designing a distributed system, the first thing to consider is 
the CAP theorem. It states that a distributed system can only guarantee 
two of three properties: Consistency, Availability, and Partition tolerance.
In practice, partition tolerance is non-negotiable in real networks, so`,
  cursorPosition: 280,
  recentEdits: [
    "Added CAP theorem definition",
    "Removed old paragraph about databases",
  ],
  userIntent: "Writing study notes for system design interviews",
});

console.log("Suggestions:");
suggestions.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));
