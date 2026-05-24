# 🧠 AI Second Brain — Personal Knowledge OS

A production-grade personal knowledge management system powered by RAG,
multi-agent AI, and semantic search.

## What it does

Ingest anything — text, PDFs, URLs, voice notes. Ask questions in natural
language. Get streaming answers grounded in your own knowledge with source
attribution. On every ingest, a proactive multi-agent system automatically
surfaces related past knowledge.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         INGESTION LAYER                         │
│  Text · PDF (pdf-parse) · URL (Cheerio) · Voice (Deepgram STT) │
│                              ↓                                  │
│        Sentence-aware chunker (400 tokens, 50 overlap)         │
│                              ↓                                  │
│              Batch embed via Voyage AI voyage-3                 │
│                         ↓         ↓                             │
│               Qdrant (vectors)  SQLite (metadata)              │
│                              ↓                                  │
│              Connections Agent (multi-agent, async)             │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                          QUERY LAYER                            │
│         User question → embed → Qdrant search (userId filter)  │
│                              ↓                                  │
│         Top-4 chunks (score_threshold 0.72) + session memory   │
│                              ↓                                  │
│          Claude Sonnet → SSE stream → source attribution        │
└─────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer         | Technology                    |
| ------------- | ----------------------------- |
| LLM (answers) | Anthropic Claude Sonnet 4.5   |
| LLM (agents)  | Anthropic Claude Haiku 4.5    |
| Embeddings    | Voyage AI voyage-3 (1024 dim) |
| Voice STT     | Deepgram nova-2               |
| Vector DB     | Qdrant (local Docker)         |
| Database      | SQLite via better-sqlite3     |
| Backend       | NestJS + TypeScript           |
| Frontend      | React + Vite + Tailwind CSS   |

## Key Technical Decisions

- **Sentence-aware chunking** over fixed-size: preserves semantic coherence,
  prevents mid-sentence splits that destroy retrieval quality
- **Batch embedding**: all chunks embedded in one API call — not sequentially
- **Hybrid memory**: last 6 turns verbatim + older turns as rolling summary
- **Model tiering**: Haiku for background agents (3.75× cheaper), Sonnet for
  user-facing answers
- **Mandatory userId filter**: every Qdrant search scoped to the requesting
  user — extracted from JWT, never from request body

## Features

- ✅ Multi-source ingestion: text, PDF, URL, voice
- ✅ Semantic search with source attribution
- ✅ Streaming chat with conversation memory
- ✅ Proactive connections agent (multi-agent)
- ✅ Cost tracking dashboard
- ✅ Retrieval + answer quality evals
- ✅ Prompt injection defence
- ✅ PII detection

## Running locally

```bash
# Prerequisites: Docker running, API keys in .env

# Start Qdrant
docker run -p 6333:6333 qdrant/qdrant

# Backend
cd backend && npm install && npm run start:dev

# Frontend
cd frontend && npm install && npm run dev
```

```env
ANTHROPIC_API_KEY=sk-ant-...
VOYAGE_API_KEY=pa-...
DEEPGRAM_API_KEY=...
QDRANT_URL=http://localhost:6333
JWT_SECRET=your-secret-here
```
