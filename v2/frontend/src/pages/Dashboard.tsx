import { useEffect, useState } from "react";
import { api } from "../api/client";

type Page = "dashboard" | "chat" | "ingest" | "notes";

type NoteRow = Awaited<ReturnType<typeof api.getNotes>>[number];

export default function Dashboard({
  onNavigate,
}: {
  onNavigate: (p: Page) => void;
}) {
  const [stats, setStats] = useState({ total: 0 });
  const [notes, setNotes] = useState<NoteRow[]>([]);

  useEffect(() => {
    api
      .getStats()
      .then((s) => setStats(s))
      .catch(() => setStats({ total: 0 }));
    api
      .getNotes()
      .then((n) => setNotes(n.slice(0, 5)))
      .catch(() => setNotes([]));
  }, []);

  const sourceIcon: Record<string, string> = {
    text: "📝",
    pdf: "📄",
    url: "🔗",
    voice: "🎙️",
  };

  const formatDate = (createdAt: string) => {
    const d = createdAt.includes("T")
      ? createdAt.split("T")[0]
      : createdAt.slice(0, 10);
    return d || createdAt;
  };

  const recentChunks = notes.reduce((a, n) => a + n.chunkCount, 0);

  return (
    <div className="p-6">
      <div className="text-sm font-medium mb-1">Dashboard</div>
      <div className="text-xs text-[#555] mb-6">Your knowledge at a glance</div>

      <div className="grid grid-cols-3 gap-3 mb-8">
        {[
          { num: stats.total, label: "Notes ingested" },
          { num: recentChunks, label: "Chunks (recent 5)" },
          { num: "-", label: "Questions asked" },
        ].map((s, i) => (
          <div
            key={i}
            className="bg-[#161616] border border-[#222] rounded-lg p-4"
          >
            <div className="text-2xl font-semibold text-[#8B7CF6]">{s.num}</div>
            <div className="text-[10px] text-[#555] mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-3 mb-8">
        <button
          type="button"
          onClick={() => onNavigate("ingest")}
          className="bg-[#8B7CF6] text-white px-4 py-2 rounded-lg text-xs hover:bg-[#7C6DE0] transition-colors"
        >
          + Add Knowledge
        </button>
        <button
          type="button"
          onClick={() => onNavigate("chat")}
          className="bg-[#161616] border border-[#222] text-[#ccc] px-4 py-2 rounded-lg text-xs hover:border-[#8B7CF6] transition-colors"
        >
          💬 Ask a Question
        </button>
      </div>

      <div className="text-[10px] font-medium text-[#555] uppercase tracking-wider mb-3">
        Recently added
      </div>
      {notes.length === 0 ? (
        <div className="text-xs text-[#444]">
          No notes yet — add your first piece of knowledge above.
        </div>
      ) : (
        notes.map((note) => (
          <div
            key={note.id}
            className="flex items-center gap-3 p-3 bg-[#161616] border border-[#1E1E1E] rounded-lg mb-2"
          >
            <span>{sourceIcon[note.sourceType] || "📝"}</span>
            <span className="text-xs text-[#ccc] flex-1 truncate">
              {note.title}
            </span>
            <span className="text-[10px] bg-[#1E1E2E] text-[#8B7CF6] px-2 py-0.5 rounded-full">
              {note.sourceType}
            </span>
            <span className="text-[10px] text-[#444]">
              {formatDate(note.createdAt)}
            </span>
          </div>
        ))
      )}
    </div>
  );
}
