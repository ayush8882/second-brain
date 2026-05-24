import { useEffect, useState } from "react";
import { api } from "../api/client";

type Page = "dashboard" | "chat" | "ingest" | "notes";
type NoteRow = Awaited<ReturnType<typeof api.getNotes>>[number];
type RecentConnection = Awaited<
  ReturnType<typeof api.getRecentConnections>
>[number];

export default function Dashboard({
  onNavigate,
}: Readonly<{ onNavigate: (p: Page) => void }>) {
  const [stats, setStats] = useState<any>(null);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [evals, setEvals] = useState<any>(null);
  const [runningEval, setRunningEval] = useState(false);
  const [connections, setConnections] = useState<RecentConnection[]>([]);

  useEffect(() => {
    api
      .getStats()
      .then(setStats)
      .catch(() => setStats(null));
    api
      .getNotes()
      .then((n) => setNotes(n.slice(0, 5)))
      .catch(() => setNotes([]));
    api
      .getRecentConnections()
      .then(setConnections)
      .catch(() => setConnections([]));
  }, []);

  async function handleRunEval() {
    setRunningEval(true);
    const result = await api.runEvals();
    setEvals(result);
    setRunningEval(false);
  }

  const totalCost = stats?.total?.total?.toFixed(4) || "0.0000";
  const requests = stats?.total?.requests || 0;
  const sourceIcon: Record<string, string> = {
    text: "📝",
    pdf: "📄",
    url: "🔗",
    voice: "🎙️",
    image: "🖼️",
  };

  return (
    <div className="p-6 overflow-y-auto h-full">
      <div className="text-sm font-medium mb-1">Dashboard</div>
      <div className="text-xs text-[#555] mb-6">Your knowledge at a glance</div>

      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { num: notes.length, label: "Notes ingested" },
          { num: requests, label: "AI queries made" },
          { num: `$${totalCost}`, label: "Total AI cost" },
          { num: connections.length, label: "Connections found" },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-[#161616] border border-[#222] rounded-lg p-4"
          >
            <div className="text-xl font-semibold text-[#8B7CF6]">{s.num}</div>
            <div className="text-[10px] text-[#555] mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {stats?.byModel && (
        <div className="bg-[#161616] border border-[#222] rounded-lg p-4 mb-5">
          <div className="text-[10px] font-medium text-[#555] uppercase tracking-wider mb-3">
            AI Cost Breakdown
          </div>
          {stats.byModel.map((m: any) => (
            <div
              key={m.model}
              className="flex justify-between items-center py-1.5 border-b border-[#1E1E1E] last:border-0"
            >
              <span className="text-xs text-[#888]">{m.model}</span>
              <div className="flex gap-4">
                <span className="text-[10px] text-[#555]">
                  {m.requests} requests
                </span>
                <span className="text-xs text-[#8B7CF6]">
                  ${Number.parseFloat(m.cost).toFixed(4)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-[#161616] border border-[#222] rounded-lg p-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] font-medium text-[#555] uppercase tracking-wider">
            System Health
          </div>
          <button
            type="button"
            onClick={handleRunEval}
            disabled={runningEval}
            className="text-[10px] bg-[#8B7CF6] text-white px-3 py-1 rounded-md disabled:opacity-40"
          >
            {runningEval ? "Running..." : "Run Evals"}
          </button>
        </div>
        {evals ? (
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-xs text-[#888]">Retrieval hit rate</span>
              <span
                className={`text-xs font-medium ${evals.retrieval.passing ? "text-green-400" : "text-red-400"}`}
              >
                {evals.retrieval.hitRate}%{" "}
                {evals.retrieval.passing ? "✅" : "❌"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-[#888]">Answer quality</span>
              <span
                className={`text-xs font-medium ${evals.quality.passing ? "text-green-400" : "text-red-400"}`}
              >
                {evals.quality.avgScore}/5 {evals.quality.passing ? "✅" : "❌"}
              </span>
            </div>
            <div className="mt-2 text-[10px] text-[#555]">
              {evals.overall.passing
                ? "✅ System is healthy"
                : "⚠️ Issues detected — check retrieval settings"}
            </div>
          </div>
        ) : (
          <div className="text-xs text-[#444]">
            Click "Run Evals" to check system health
          </div>
        )}
      </div>

      <div className="flex gap-3 mb-6">
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
            <div className="flex-1 min-w-0">
              <div className="text-xs text-[#ccc] truncate">{note.title}</div>
              <div className="text-[10px] text-[#444] mt-0.5">
                {note.chunkCount} chunks
              </div>
            </div>
            <span className="text-[10px] bg-[#1E1E2E] text-[#8B7CF6] px-2 py-0.5 rounded-full">
              {note.sourceType}
            </span>
          </div>
        ))
      )}

      {connections.length > 0 && (
        <>
          <div className="text-[10px] font-medium text-[#555] uppercase tracking-wider mt-6 mb-3">
            🔗 Knowledge connections
          </div>
          {connections.map((c: any) => (
            <div
              key={c.id}
              className="p-3 bg-[#0D0D0D] border border-[#1E1E2E] rounded-lg mb-2"
            >
              <div className="text-[10px] text-[#8B7CF6] mb-1 font-medium truncate">
                "{c.noteTitle}"
              </div>
              <div className="text-xs text-[#777] leading-relaxed">
                {c.insight}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
