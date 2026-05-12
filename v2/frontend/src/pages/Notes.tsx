import { useEffect, useState } from "react";
import { api } from "../api/client";

type NoteRow = Awaited<ReturnType<typeof api.getNotes>>[number];

export default function Notes() {
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.getNotes().then(setNotes).catch(() => setNotes([]));
  }, []);

  const sourceIcon: Record<string, string> = {
    text: "📝",
    pdf: "📄",
    url: "🔗",
    voice: "🎙️",
  };

  const filtered = notes.filter((n) =>
    n.title.toLowerCase().includes(search.toLowerCase()),
  );

  async function deleteNote(id: string) {
    try {
      await api.deleteNote(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch {
      /* optional: toast */
    }
  }

  const formatDate = (createdAt: string) => {
    const d = createdAt.includes("T")
      ? createdAt.split("T")[0]
      : createdAt.slice(0, 10);
    return d || createdAt;
  };

  return (
    <div className="p-6">
      <div className="text-sm font-medium mb-1">Notes Library</div>
      <div className="text-xs text-[#555] mb-4">
        All your ingested knowledge
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="🔍 Search notes..."
        className="w-full bg-[#161616] border border-[#222] rounded-lg px-3 py-2 text-sm text-[#ccc] outline-none placeholder-[#444] focus:border-[#8B7CF6] mb-4"
      />

      {filtered.length === 0 ? (
        <div className="text-xs text-[#444]">No notes found.</div>
      ) : (
        filtered.map((note) => (
          <div
            key={note.id}
            className="flex items-center gap-3 p-3 bg-[#161616] border border-[#1E1E1E] rounded-lg mb-2 group"
          >
            <span className="text-base">
              {sourceIcon[note.sourceType] || "📝"}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-[#ccc] truncate">{note.title}</div>
              <div className="text-[10px] text-[#444] mt-0.5">
                {note.chunkCount} chunks · {formatDate(note.createdAt)}
              </div>
            </div>
            <span className="text-[10px] bg-[#1E1E2E] text-[#8B7CF6] px-2 py-0.5 rounded-full flex-shrink-0">
              {note.sourceType}
            </span>
            <button
              type="button"
              onClick={() => deleteNote(note.id)}
              className="text-[#333] hover:text-red-500 text-xs opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
            >
              ✕
            </button>
          </div>
        ))
      )}
    </div>
  );
}
