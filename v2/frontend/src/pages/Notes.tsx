import { useEffect, useState, type MouseEvent } from "react";
import { api } from "../api/client";

type NoteRow = Awaited<ReturnType<typeof api.getNotes>>[number];

type NoteConnection = Extract<
  Awaited<ReturnType<typeof api.getConnections>>,
  { found: true }
>;

export default function Notes() {
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [search, setSearch] = useState("");
  const [selectedNote, setSelectedNote] = useState<string | null>(null);
  const [connection, setConnection] = useState<NoteConnection | null>(null);
  const [loadingConnection, setLoadingConnection] = useState(false);

  useEffect(() => {
    api
      .getNotes()
      .then(setNotes)
      .catch(() => setNotes([]));
  }, []);

  const sourceIcon: Record<string, string> = {
    text: "📝",
    pdf: "📄",
    url: "🔗",
    voice: "🎙️",
    image: "🖼️",
  };

  const filtered = notes.filter((n) =>
    n.title.toLowerCase().includes(search.toLowerCase()),
  );

  async function deleteNote(id: string, e: MouseEvent) {
    e.stopPropagation();
    try {
      await api.deleteNote(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
      if (selectedNote === id) {
        setSelectedNote(null);
        setConnection(null);
      }
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

  async function selectNote(noteId: string) {
    if (selectedNote === noteId) {
      setSelectedNote(null);
      setConnection(null);
      return;
    }

    setSelectedNote(noteId);
    setConnection(null);
    setLoadingConnection(true);

    try {
      const data = await api.getConnections(noteId);
      setConnection(data.found ? data : null);
    } catch {
      setConnection(null);
    } finally {
      setLoadingConnection(false);
    }
  }

  const selectedNoteTitle =
    notes.find((n) => n.id === selectedNote)?.title ?? "Note";

  return (
    <div className="p-6 max-w-2xl">
      <div className="text-sm font-medium mb-1">Notes Library</div>
      <div className="text-xs text-[#555] mb-4">
        All your ingested knowledge — click a note to see connections
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
            role="button"
            tabIndex={0}
            onClick={() => selectNote(note.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                void selectNote(note.id);
              }
            }}
            className={`flex items-center gap-3 p-3 border rounded-lg mb-2 cursor-pointer transition-colors group
              ${
                selectedNote === note.id
                  ? "bg-[#1E1E2E] border-[#8B7CF6]"
                  : "bg-[#161616] border-[#1E1E1E] hover:border-[#333]"
              }`}
          >
            <span className="text-base">
              {sourceIcon[note.sourceType] || "📝"}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-[#ccc] truncate">
                {note.title}
              </div>
              <div className="text-[10px] text-[#444] mt-0.5">
                {note.chunkCount} chunks · {formatDate(note.createdAt)}
              </div>
            </div>
            <span className="text-[10px] bg-[#1E1E2E] text-[#8B7CF6] px-2 py-0.5 rounded-full flex-shrink-0">
              {note.sourceType}
            </span>
            <button
              type="button"
              onClick={(e) => deleteNote(note.id, e)}
              className="text-[#333] hover:text-red-500 text-xs opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
              aria-label={`Delete ${note.title}`}
            >
              ✕
            </button>
          </div>
        ))
      )}

      {selectedNote && loadingConnection && (
        <div className="mt-6 p-4 bg-[#0D0D0D] border border-[#222] rounded-xl">
          <div className="text-xs text-[#555]">Loading connections…</div>
        </div>
      )}

      {selectedNote && !loadingConnection && connection && (
        <div className="mt-6 p-4 bg-[#0D0D0D] border border-[#1E1E2E] rounded-xl">
          <div className="text-[10px] font-medium text-[#8B7CF6] uppercase tracking-wider mb-1">
            🔗 Connections found
          </div>
          <div className="text-[10px] text-[#555] mb-2 truncate">
            {selectedNoteTitle}
          </div>
          <div className="text-xs text-[#999] leading-relaxed">
            {connection.insight}
          </div>
          {connection.relatedIds.length > 0 && (
            <div className="text-[10px] text-[#444] mt-3">
              Related to {connection.relatedIds.length} note
              {connection.relatedIds.length === 1 ? "" : "s"}
            </div>
          )}
        </div>
      )}

      {selectedNote && !loadingConnection && !connection && (
        <div className="mt-6 p-4 bg-[#0D0D0D] border border-[#222] rounded-xl">
          <div className="text-xs text-[#444]">
            No connections found yet for "{selectedNoteTitle}" — add more notes
            to your knowledge base.
          </div>
        </div>
      )}
    </div>
  );
}
