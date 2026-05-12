import { useState } from "react";
import { api } from "../api/client";

type Tab = "text" | "pdf" | "url";

export default function Ingest() {
  const [tab, setTab] = useState<Tab>("text");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleSubmit() {
    if (!title.trim()) {
      setResult("Please enter a title.");
      return;
    }
    setLoading(true);
    setResult(null);

    try {
      let res: Awaited<ReturnType<typeof api.ingestText>>;
      switch (tab) {
        case "text":
          res = await api.ingestText(title, text);
          break;
        case "url":
          res = await api.ingestUrl(title, url);
          break;
        case "pdf":
          if (!file) {
            setResult("Please choose a PDF file.");
            setLoading(false);
            return;
          }
          res = await api.ingestPdf(title, file);
          break;
      }
      setResult(`✓ Added "${res.title}" — ${res.chunkCount} chunks stored`);
      setTitle("");
      setText("");
      setUrl("");
      setFile(null);
    } catch (e: unknown) {
      setResult(
        `Error: ${e instanceof Error ? e.message : "Request failed"}`,
      );
    }
    setLoading(false);
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "text", label: "📝 Text" },
    { id: "pdf", label: "📄 PDF" },
    { id: "url", label: "🔗 URL" },
  ];

  return (
    <div className="p-6 max-w-2xl">
      <div className="text-sm font-medium mb-1">Add Knowledge</div>
      <div className="text-xs text-[#555] mb-6">
        Feed your brain new information
      </div>

      {/* Tab selector */}
      <div className="flex gap-1 bg-[#161616] rounded-lg p-1 border border-[#222] mb-5 w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-1.5 rounded-md text-xs transition-colors
              ${tab === t.id ? "bg-[#8B7CF6] text-white" : "text-[#555] hover:text-[#888]"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Title */}
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title for this note..."
        className="w-full bg-[#161616] border border-[#222] rounded-lg px-3 py-2 text-sm text-[#ccc] outline-none placeholder-[#444] focus:border-[#8B7CF6] mb-3"
      />

      {/* Input area */}
      {tab === "text" && (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste any text, notes, article, or ideas here..."
          rows={8}
          className="w-full bg-[#161616] border border-[#222] rounded-lg px-3 py-2 text-sm text-[#ccc] outline-none resize-none placeholder-[#444] focus:border-[#8B7CF6]"
        />
      )}

      {tab === "url" && (
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
          className="w-full bg-[#161616] border border-[#222] rounded-lg px-3 py-2 text-sm text-[#ccc] outline-none placeholder-[#444] focus:border-[#8B7CF6]"
        />
      )}

      {tab === "pdf" && (
        <div
          className="border border-dashed border-[#333] rounded-lg p-8 text-center cursor-pointer hover:border-[#8B7CF6] transition-colors"
          onClick={() => document.getElementById("pdf-input")?.click()}
        >
          <div className="text-2xl mb-2">📄</div>
          <div className="text-xs text-[#555]">
            {file ? file.name : "Click to upload PDF"}
          </div>
          <input
            id="pdf-input"
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="mt-4 bg-[#8B7CF6] text-white px-6 py-2 rounded-lg text-sm hover:bg-[#7C6DE0] transition-colors disabled:opacity-40"
      >
        {loading ? "Processing..." : "Add to Brain →"}
      </button>

      {result && (
        <div
          className={`mt-4 text-xs p-3 rounded-lg ${
            result.startsWith("✓")
              ? "bg-[#1E2A1E] text-[#4CAF50]"
              : "bg-[#2A1E1E] text-[#F44336]"
          }`}
        >
          {result}
        </div>
      )}
    </div>
  );
}
