import { useState, useRef, useEffect } from "react";
import { AssistantMarkdown } from "../components/AssistantMarkdown";

type SourceBrief = { title: string; sourceType: string; score: number };

type Message = {
  role: "user" | "assistant";
  content: string;
  sources?: SourceBrief[];
  tone?: "default" | "muted" | "error";
};

const SESSION_ID = "session-" + Date.now();

const SOURCE_ICONS: Record<string, string> = {
  text: "📝",
  pdf: "📄",
  url: "🔗",
  voice: "🎙️",
  image: "🖼️",
};

function parseApiError(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "Something went wrong. Please try again.";
  try {
    const body = JSON.parse(trimmed) as {
      message?: string | string[];
    };
    if (Array.isArray(body.message)) return body.message.join(", ");
    if (typeof body.message === "string") return body.message;
  } catch {
    /* plain text */
  }
  if (trimmed.length > 200) {
    return "The server returned an error. Check that the backend is running.";
  }
  return trimmed;
}

function formatMatch(score: number): string {
  const pct = Math.min(100, Math.max(0, score * 100));
  if (pct >= 70) return "Strong match";
  if (pct >= 50) return "Good match";
  return "Related";
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [activeSources, setActiveSources] = useState<SourceBrief[]>([]);
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  function patchLastAssistant(
    patch: Partial<Message> | ((msg: Message) => Partial<Message>),
  ) {
    setMessages((prev) => {
      const updated = [...prev];
      const idx = updated.length - 1;
      if (idx < 0 || updated[idx]?.role !== "assistant") return prev;
      const extra =
        typeof patch === "function" ? patch(updated[idx]!) : patch;
      updated[idx] = { ...updated[idx]!, ...extra };
      return updated;
    });
  }

  async function send() {
    if (!input.trim() || streaming) return;

    const question = input.trim();
    setInput("");
    setStreaming(true);
    setActiveSources([]);

    setMessages((prev) => [
      ...prev,
      { role: "user", content: question },
      { role: "assistant", content: "", tone: "default" },
    ]);

    const params = new URLSearchParams({
      sessionId: SESSION_ID,
      question,
    });

    try {
      const response = await fetch(`/api/chat/ask?${params.toString()}`, {
        method: "GET",
        headers: { Accept: "text/event-stream" },
      });

      if (!response.ok || !response.body) {
        const errText = await response.text().catch(() => "");
        patchLastAssistant({
          content: parseApiError(errText),
          tone: "error",
        });
        setStreaming(false);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          for (const line of part.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (!payload) continue;

            try {
              const event = JSON.parse(payload) as {
                type: string;
                text?: string;
                message?: string;
                sources?: SourceBrief[];
              };

              if (event.type === "sources" && event.sources) {
                setActiveSources(event.sources);
                patchLastAssistant({ sources: event.sources });
              }

              if (event.type === "token" && event.text) {
                setMessages((prev) => {
                  const updated = [...prev];
                  const idx = updated.length - 1;
                  if (updated[idx]?.role !== "assistant") return prev;
                  updated[idx] = {
                    ...updated[idx]!,
                    content: updated[idx]!.content + event.text,
                    tone: "default",
                  };
                  return updated;
                });
              }

              if (event.type === "no_context") {
                patchLastAssistant({
                  content:
                    "I couldn't find anything in your notes that matches this question.\n\nTry:\n- Rephrasing with different words\n- Adding more notes on this topic\n- Being more specific (e.g. mention the note title or what the image showed)",
                  tone: "muted",
                });
              }

              if (event.type === "error") {
                patchLastAssistant({
                  content: parseApiError(
                    typeof event.message === "string"
                      ? event.message
                      : "Something went wrong.",
                  ),
                  tone: "error",
                });
                setStreaming(false);
              }

              if (event.type === "done") {
                setStreaming(false);
              }
            } catch {
              /* ignore malformed SSE */
            }
          }
        }
      }
    } catch {
      patchLastAssistant({
        content:
          "Couldn't reach the server. Make sure the backend is running on port 3000.",
        tone: "error",
      });
    }

    setStreaming(false);
  }

  const lastAssistantIdx = messages.findLastIndex((m) => m.role === "assistant");
  const sidebarSources =
    lastAssistantIdx >= 0
      ? (messages[lastAssistantIdx]?.sources ?? activeSources)
      : activeSources;

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="p-4 border-b border-[#1A1A1A]">
          <div className="text-sm font-medium">Ask Your Brain</div>
          <div className="text-xs text-[#555] mt-0.5">
            Answers are based only on notes you've saved
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {messages.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6 gap-3">
              <div className="text-3xl">💬</div>
              <p className="text-sm text-[#888] max-w-sm">
                Ask about anything in your knowledge base — text notes, PDFs,
                URLs, voice memos, or images.
              </p>
              <div className="text-xs text-[#555] space-y-1">
                <p className="text-[#666]">Try asking:</p>
                <p>"What did my last image note contain?"</p>
                <p>"Summarize my notes about …"</p>
              </div>
            </div>
          )}

          {messages.map((msg, i) => {
            const isUser = msg.role === "user";
            const isStreamingAssistant =
              streaming &&
              i === messages.length - 1 &&
              msg.role === "assistant";

            if (isUser) {
              return (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] sm:max-w-[70%] rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-relaxed bg-[#8B7CF6] text-white shadow-sm">
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              );
            }

            const bubbleClass =
              msg.tone === "error"
                ? "bg-[#2a1515] border-[#4a2020] text-[#f5a8a8]"
                : msg.tone === "muted"
                  ? "bg-[#161616] border-[#2a2a2a] text-[#999]"
                  : "bg-[#161616] border-[#222] text-[#ccc]";

            return (
              <div key={i} className="flex justify-start">
                <div
                  className={`max-w-[92%] sm:max-w-[80%] rounded-2xl rounded-bl-md px-4 py-3 border shadow-sm ${bubbleClass}`}
                >
                  {msg.tone === "error" && (
                    <div className="text-[10px] font-medium uppercase tracking-wider text-[#f44336] mb-2">
                      Something went wrong
                    </div>
                  )}
                  {msg.tone === "muted" && (
                    <div className="text-[10px] font-medium uppercase tracking-wider text-[#666] mb-2">
                      No matching notes
                    </div>
                  )}
                  <AssistantMarkdown
                    content={msg.content}
                    streaming={isStreamingAssistant}
                  />
                  {msg.sources && msg.sources.length > 0 && !isStreamingAssistant && (
                    <div className="mt-3 pt-3 border-t border-[#2a2a2a] flex flex-wrap gap-1.5">
                      {msg.sources.slice(0, 4).map((s, j) => (
                        <span
                          key={j}
                          className="inline-flex items-center gap-1 text-[10px] bg-[#1E1E2E] text-[#8B7CF6] px-2 py-1 rounded-full"
                          title={`${formatMatch(s.score)} · ${(s.score * 100).toFixed(0)}%`}
                        >
                          <span>{SOURCE_ICONS[s.sourceType] ?? "📎"}</span>
                          <span className="truncate max-w-[140px]">
                            {s.title}
                          </span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        <div className="p-4 border-t border-[#1A1A1A] flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="Ask about your notes…"
            rows={2}
            disabled={streaming}
            className="flex-1 bg-[#161616] border border-[#222] rounded-xl px-3 py-2.5 text-sm text-[#ccc] outline-none resize-none placeholder-[#444] focus:border-[#8B7CF6] disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={streaming || !input.trim()}
            className="w-10 h-10 bg-[#8B7CF6] rounded-xl flex items-center justify-center text-white disabled:opacity-40 hover:bg-[#7C6DE0] transition-colors flex-shrink-0"
            aria-label="Send message"
          >
            {streaming ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              "↑"
            )}
          </button>
        </div>
      </div>

      <aside className="w-52 shrink-0 border-l border-[#1A1A1A] p-4 bg-[#0D0D0D] hidden sm:block">
        <div className="text-[10px] font-medium text-[#555] uppercase tracking-wider mb-3">
          Sources used
        </div>
        {sidebarSources.length === 0 ? (
          <p className="text-[10px] text-[#444] leading-relaxed">
            Relevant notes from your library will appear here after each answer.
          </p>
        ) : (
          <ul className="space-y-2">
            {sidebarSources.map((s, i) => (
              <li
                key={i}
                className="bg-[#161616] border border-[#1E1E1E] rounded-lg p-2.5"
              >
                <div className="flex items-start gap-1.5 mb-1">
                  <span className="text-sm shrink-0">
                    {SOURCE_ICONS[s.sourceType] ?? "📎"}
                  </span>
                  <span className="text-[10px] text-[#ccc] font-medium leading-snug line-clamp-2">
                    {s.title}
                  </span>
                </div>
                <div className="text-[9px] text-[#555] capitalize mb-1.5">
                  {s.sourceType}
                </div>
                <div className="h-1 bg-[#222] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#8B7CF6] rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, Math.max(8, s.score * 100))}%`,
                    }}
                  />
                </div>
                <div className="text-[9px] text-[#666] mt-1">
                  {formatMatch(s.score)} · {(s.score * 100).toFixed(0)}%
                </div>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
