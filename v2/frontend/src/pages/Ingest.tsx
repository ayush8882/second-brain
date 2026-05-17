import { useRef, useState } from "react";
import { api } from "../api/client";

type Tab = "text" | "pdf" | "url" | "voice";

function pickRecorderMime(): string | undefined {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
  ];
  for (const t of candidates) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return undefined;
}

function extForMime(mime: string): string {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("mp4") || mime.includes("m4a")) return "m4a";
  return "webm";
}

type VoiceRecorderProps = {
  disabled: boolean;
  onRecorded: (blob: Blob) => void | Promise<void>;
};

function VoiceRecorder({ disabled, onRecorded }: VoiceRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function startRecording() {
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const mimeType = pickRecorderMime();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const type =
          recorder.mimeType ||
          mimeType ||
          chunksRef.current[0]?.type ||
          "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        const ext = extForMime(type);
        void onRecorded(
          new File([blob], `recording.${ext}`, { type: blob.type || type }),
        );
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start(250);
      mediaRef.current = recorder;
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : "Could not access microphone";
      setMicError(msg);
    }
  }

  function stopRecording() {
    mediaRef.current?.stop();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRecording(false);
  }

  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <button
        type="button"
        disabled={disabled}
        onClick={recording ? stopRecording : startRecording}
        className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl transition-all disabled:opacity-40 disabled:cursor-not-allowed
          ${
            recording
              ? "bg-red-500 hover:bg-red-600 animate-pulse"
              : "bg-[#8B7CF6] hover:bg-[#7C6DE0]"
          }`}
      >
        {recording ? "⏹" : "🎙️"}
      </button>
      <div className="text-xs text-[#555] text-center max-w-sm">
        {micError ? (
          <span className="text-[#F44336]">{micError}</span>
        ) : recording ? (
          `Recording... ${seconds}s (click to stop)`
        ) : disabled ? (
          "Processing…"
        ) : (
          "Click to start — your note uploads when you stop"
        )}
      </div>
    </div>
  );
}

export default function Ingest() {
  const [tab, setTab] = useState<Tab>("text");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const isVoiceTab = tab === "voice";

  async function handleSubmit() {
    if (isVoiceTab) {
      setResult("Use the recorder — the note is saved when you stop recording.");
      return;
    }
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
        default:
          setLoading(false);
          return;
      }
      setResult(`✓ Added "${res.title}" — ${res.chunkCount} chunks stored`);
      setTitle("");
      setText("");
      setUrl("");
      setFile(null);
    } catch (e: unknown) {
      setResult(`Error: ${e instanceof Error ? e.message : "Request failed"}`);
    }
    setLoading(false);
  }

  async function handleVoiceUpload(blob: Blob) {
    setLoading(true);
    setResult(null);
    try {
      const res = await api.ingestVoice(
        blob,
        title.trim() ? title.trim() : undefined,
      );
      setResult(
        `✓ Voice note "${res.title}" added — ${res.chunkCount} chunks stored`,
      );
      setTitle("");
    } catch (e: unknown) {
      setResult(`Error: ${e instanceof Error ? e.message : "Request failed"}`);
    } finally {
      setLoading(false);
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "text", label: "📝 Text" },
    { id: "pdf", label: "📄 PDF" },
    { id: "url", label: "🔗 URL" },
    { id: "voice", label: "🎤 Voice" },
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
            type="button"
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
        placeholder={
          isVoiceTab
            ? "Optional title — generated from audio if empty"
            : "Title for this note..."
        }
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

      {tab === "voice" && (
        <>
          <p className="text-xs text-[#666] mb-2">
            Records in the browser, then sends audio to the server for
            transcription and embedding (same pipeline as text notes).
          </p>
          <VoiceRecorder
            disabled={loading}
            onRecorded={handleVoiceUpload}
          />
        </>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={loading || isVoiceTab}
        className="mt-4 bg-[#8B7CF6] text-white px-6 py-2 rounded-lg text-sm hover:bg-[#7C6DE0] transition-colors disabled:opacity-40"
      >
        {loading ? "Processing..." : "Add to Brain →"}
      </button>
      {isVoiceTab && (
        <p className="mt-2 text-[10px] text-[#555]">
          Voice notes save automatically when you stop recording (this button is
          for text, PDF, and URL only).
        </p>
      )}

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
