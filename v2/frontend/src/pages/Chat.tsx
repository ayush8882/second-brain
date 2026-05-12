import { useState, useRef, useEffect } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
  sources?: { title: string; sourceType: string; score: number }[];
};

type SourceBrief = { title: string; sourceType: string; score: number };

const SESSION_ID = "session-" + Date.now();

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sources, setSources] = useState<SourceBrief[]>([]);
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    if (!input.trim() || streaming) return;

    const question = input.trim();
    setInput("");
    setStreaming(true);
    setSources([]);

    // Add user message
    setMessages((prev) => [...prev, { role: "user", content: question }]);

    // Add empty assistant message — we'll fill it as tokens arrive
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    const params = new URLSearchParams({
      sessionId: SESSION_ID,
      question,
    });
    const response = await fetch(`/api/chat/ask?${params.toString()}`, {
      method: "GET",
      headers: { Accept: "text/event-stream" },
    });

    if (!response.ok || !response.body) {
      const errText = await response.text().catch(() => "");
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          content:
            errText ||
            `Could not reach the chat API (${response.status}). Is the backend running on port 3000?`,
        };
        return updated;
      });
      setStreaming(false);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const lines = decoder.decode(value).split("\n");
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const event = JSON.parse(line.replace("data: ", ""));

          if (event.type === "sources") {
            setSources(event.sources);
          }

          if (event.type === "token") {
            // Append token to last message
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                ...updated[updated.length - 1],
                content: updated[updated.length - 1].content + event.text,
              };
              return updated;
            });
          }

          if (event.type === "no_context") {
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1].content =
                "No relevant notes found for that question. Try ingesting more content or rephrase your question.";
              return updated;
            });
          }

          if (event.type === "error") {
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                ...updated[updated.length - 1],
                content:
                  typeof event.message === "string"
                    ? event.message
                    : "Something went wrong.",
              };
              return updated;
            });
            setStreaming(false);
          }

          if (event.type === "done") {
            setStreaming(false);
          }
        } catch {
          /* ignore malformed SSE lines */
        }
      }
    }

    setStreaming(false);
  }

  return (
    <div className="flex h-full">
      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b border-[#1A1A1A]">
          <div className="text-sm font-medium">Ask Your Brain</div>
          <div className="text-xs text-[#555] mt-0.5">
            Chat with your knowledge base
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {messages.length === 0 && (
            <div className="flex-1 flex items-center justify-center text-[#444] text-sm">
              Ask anything about your saved notes...
            </div>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] rounded-xl px-4 py-2.5 text-sm leading-relaxed
                ${
                  msg.role === "user"
                    ? "bg-[#8B7CF6] text-white rounded-br-sm"
                    : "bg-[#161616] text-[#ccc] border border-[#222] rounded-bl-sm"
                }`}
              >
                {msg.content}
                {/* Blinking cursor while streaming */}
                {msg.role === "assistant" &&
                  streaming &&
                  i === messages.length - 1 && (
                    <span className="inline-block w-0.5 h-3.5 bg-[#8B7CF6] ml-0.5 align-middle animate-pulse" />
                  )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-[#1A1A1A] flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Ask anything about your knowledge base..."
            rows={1}
            className="flex-1 bg-[#161616] border border-[#222] rounded-lg px-3 py-2 text-sm text-[#ccc] outline-none resize-none placeholder-[#444] focus:border-[#8B7CF6]"
          />
          <button
            onClick={send}
            disabled={streaming}
            className="w-9 h-9 bg-[#8B7CF6] rounded-lg flex items-center justify-center text-white disabled:opacity-40 hover:bg-[#7C6DE0] transition-colors flex-shrink-0"
          >
            ↑
          </button>
        </div>
      </div>

      {/* Sources panel */}
      <div className="w-48 border-l border-[#1A1A1A] p-4 bg-[#0D0D0D]">
        <div className="text-[10px] font-medium text-[#555] uppercase tracking-wider mb-3">
          Sources used
        </div>
        {sources.length === 0 ? (
          <div className="text-[10px] text-[#333]">
            Sources appear here after you ask a question
          </div>
        ) : (
          sources.map((s, i) => (
            <div
              key={i}
              className="bg-[#161616] border border-[#1E1E1E] rounded-md p-2 mb-2"
            >
              <div className="text-[10px] text-[#ccc] font-medium mb-1 truncate">
                {s.title}
              </div>
              <div className="text-[9px] text-[#555]">{s.sourceType}</div>
              <div className="h-0.5 bg-[#222] rounded mt-2 overflow-hidden">
                <div
                  className="h-full bg-[#8B7CF6] rounded"
                  style={{
                    width: `${Math.min(100, Math.max(0, s.score * 100))}%`,
                  }}
                />
              </div>
              <div className="text-[9px] text-[#555] mt-1">
                {(Math.min(1, Math.max(0, s.score)) * 100).toFixed(0)}% match
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
