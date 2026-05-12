const sessions = new Map();
const MAX_RECENT_TURNS = 6;

function getSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      messages: [],
      summary: "",
    });
  }
  return sessions.get(sessionId);
}

export function buildMessages(sessionId, currentQuestion) {
  const session = getSession(sessionId);
  const messages = [];

  // Prepend compressed summary if exists
  if (session.summary) {
    messages.push(
      { role: "user", content: `[Earlier conversation: ${session.summary}]` },
      {
        role: "assistant",
        content: "Understood, I have context from our earlier conversation.",
      },
    );
  }

  // Add recent turns verbatim
  messages.push(...session.messages);

  // Add current question
  messages.push({ role: "user", content: currentQuestion });

  return messages;
}

export function saveTurn(sessionId, userMsg, assistantMsg) {
  const session = getSession(sessionId);

  session.messages.push(
    { role: "user", content: userMsg },
    { role: "assistant", content: assistantMsg },
  );

  // Slide the window — drop oldest pair when over limit
  const maxMessages = MAX_RECENT_TURNS * 2;
  if (session.messages.length > maxMessages) {
    session.messages.splice(0, 2);
  }
}

export function clearSession(sessionId) {
  sessions.delete(sessionId);
}

export function listSessions() {
  return [...sessions.keys()];
}
