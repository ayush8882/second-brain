const BASE = "/api";

async function ensureOk(res: Response): Promise<void> {
  if (res.ok) return;
  let message = res.statusText;
  try {
    const body = (await res.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) {
      message = body.message.join(", ");
    } else if (typeof body.message === "string") {
      message = body.message;
    }
  } catch {
    /* ignore */
  }
  throw new Error(message || `Request failed (${res.status})`);
}

export const api = {
  getNotes: async () => {
    const res = await fetch(`${BASE}/notes`);
    await ensureOk(res);
    return res.json() as Promise<
      {
        id: string;
        title: string;
        sourceType: string;
        sourceRef: string;
        chunkCount: number;
        createdAt: string;
      }[]
    >;
  },

  getStats: async () => {
    const res = await fetch(`${BASE}/notes/stats`);
    await ensureOk(res);
    const data = (await res.json()) as { count: number };
    return { total: data.count };
  },

  deleteNote: async (id: string) => {
    const res = await fetch(`${BASE}/notes/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    await ensureOk(res);
    return res.json() as Promise<{ deleted: boolean }>;
  },

  getConnections: async (noteId: string) => {
    const res = await fetch(
      `${BASE}/notes/${encodeURIComponent(noteId)}/connections`,
    );
    await ensureOk(res);
    return res.json() as Promise<
      | { found: false }
      | {
          found: true;
          insight: string;
          relatedIds: string[];
          createdAt: string;
        }
    >;
  },

  getRecentConnections: async () => {
    const res = await fetch(`${BASE}/notes/connections/recent`);
    await ensureOk(res);
    return res.json() as Promise<
      {
        id: string;
        noteId: string;
        noteTitle: string;
        insight: string;
        relatedIds: string[];
        createdAt: string;
      }[]
    >;
  },

  ingestText: async (title: string, text: string) => {
    const res = await fetch(`${BASE}/ingest/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, text }),
    });
    await ensureOk(res);
    return res.json() as Promise<{
      noteId: string;
      chunkCount: number;
      title: string;
    }>;
  },

  ingestUrl: async (title: string, url: string) => {
    const res = await fetch(`${BASE}/ingest/url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, url }),
    });
    await ensureOk(res);
    return res.json() as Promise<{
      noteId: string;
      chunkCount: number;
      title: string;
    }>;
  },

  ingestPdf: async (title: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    form.append("title", title);
    const res = await fetch(`${BASE}/ingest/pdf`, {
      method: "POST",
      body: form,
    });
    await ensureOk(res);
    return res.json() as Promise<{
      noteId: string;
      chunkCount: number;
      title: string;
    }>;
  },

  /** Multipart field name must be `audio` (matches backend FileInterceptor). */
  ingestVoice: async (audioBlob: Blob, title?: string) => {
    const form = new FormData();
    const name =
      audioBlob instanceof File && audioBlob.name
        ? audioBlob.name
        : "recording.webm";
    form.append("audio", audioBlob, name);
    if (title?.trim()) {
      form.append("title", title.trim());
    }
    const res = await fetch(`${BASE}/ingest/voice`, {
      method: "POST",
      body: form,
    });
    await ensureOk(res);
    return res.json() as Promise<{
      noteId: string;
      chunkCount: number;
      title: string;
    }>;
  },

  /** SSE: GET /api/chat/ask — use when consuming with EventSource. */
  askStream: (sessionId: string, question: string): EventSource => {
    const params = new URLSearchParams({
      sessionId,
      question,
    });
    return new EventSource(`${BASE}/chat/ask?${params.toString()}`);
  },
};
