import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
dotenv.config();

const claude = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Trigger conditions — when should the copilot offer help?
const TRIGGERS = {
  IDLE_AFTER_TYPING: 3000, // user stopped typing for 3 seconds
  DOCUMENT_OPENED: 1000, // user just opened a new document
  LONG_PARAGRAPH: 300, // user wrote a paragraph > 300 words
  QUESTION_DETECTED: true, // user's text ends with a question mark
};

// Detect what kind of help is needed based on current state
function detectHelpNeeded(editorState) {
  const { text, lastActivity, wordCount, selectedText } = editorState;

  if (selectedText?.length > 20) return "IMPROVE_SELECTION";
  if (text.trim().endsWith("?")) return "ANSWER_QUESTION";
  if (wordCount > 300) return "SUMMARISE_SO_FAR";
  if (lastActivity === "opened") return "CONTINUE_FROM_LAST";
  return "SUGGEST_NEXT";
}

async function proactiveSuggestion(editorState, knowledgeBase = []) {
  const helpType = detectHelpNeeded(editorState);

  // Build context from knowledge base (RAG-style)
  // Pull in related notes the user has written before
  const relatedContext = knowledgeBase
    .filter((note) => note.relevanceScore > 0.75)
    .slice(0, 2)
    .map((note) => `From your note "${note.title}": ${note.snippet}`)
    .join("\n\n");

  const prompts = {
    IMPROVE_SELECTION: `The user selected this text: "${editorState.selectedText}"
Suggest 2 ways to improve it — clearer, more concise, or more impactful.`,

    ANSWER_QUESTION: `The user is writing and ended with a question: "${editorState.text.slice(-200)}"
They seem to be asking themselves a question while writing.
Suggest how they might answer it based on their previous notes below.`,

    SUMMARISE_SO_FAR: `The user has written ${editorState.wordCount} words.
Here's the last 300 words: "${editorState.text.slice(-1200)}"
Offer a one-paragraph summary they could add at the top.`,

    CONTINUE_FROM_LAST: `The user just opened a document they were working on.
Last content: "${editorState.text.slice(-400)}"
Suggest what they might want to write next to continue.`,

    SUGGEST_NEXT: `Current writing: "${editorState.text.slice(-600)}"
Suggest what would logically come next.`,
  };

  const response = await claude.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 250,
    temperature: 0.6,
    system: `You are a proactive writing copilot in a knowledge management app.
Be specific to what the user is working on. Be concise — 2-3 sentences max per suggestion.
${relatedContext ? `\nUSER'S RELATED NOTES FOR CONTEXT:\n${relatedContext}` : ""}`,
    messages: [{ role: "user", content: prompts[helpType] }],
  });

  return {
    type: helpType,
    suggestion: response.content[0].text,
    triggeredBy: helpType,
  };
}

// Simulate the copilot watching a user write
const mockEditorState = {
  text: `The transformer architecture revolutionised NLP by introducing self-attention.
Unlike RNNs that process tokens sequentially, transformers process all tokens in parallel.
This makes them much faster to train on modern GPUs. The attention mechanism allows
each token to directly influence every other token, regardless of distance. This solved
the long-range dependency problem that plagued earlier architectures. But I'm wondering —
how does this compare to state space models like Mamba?`,
  selectedText: null,
  wordCount: 89,
  lastActivity: "typing",
};

const mockKnowledgeBase = [
  {
    title: "Mamba Architecture Notes",
    snippet: "Mamba uses selective state spaces instead of attention...",
    relevanceScore: 0.88,
  },
  {
    title: "LLM Comparison Chart",
    snippet: "Transformers vs SSMs: quadratic vs linear complexity...",
    relevanceScore: 0.81,
  },
];

const result = await proactiveSuggestion(mockEditorState, mockKnowledgeBase);
console.log(`\nCopilot trigger: ${result.type}`);
console.log(`Suggestion:\n${result.suggestion}`);
