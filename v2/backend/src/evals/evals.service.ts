import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { VoyageAIClient } from 'voyageai';
import { QdrantClient } from '@qdrant/js-client-rest';
import { config } from '../config/config';
import { getNoteById, getRecentNotes, type NoteDetailRow } from '../db';

@Injectable()
export class EvalsService {
  private readonly claude = new Anthropic({ apiKey: config.anthropicKey });
  private readonly voyage = new VoyageAIClient({ apiKey: config.voyageKey });

  constructor(private readonly qdrant: QdrantClient) {}

  // ── Retrieval eval ────────────────────────────────────────
  async evalRetrieval(userId: string) {
    // Build test cases from the user's ACTUAL notes
    // In production: maintain a curated test set
    // For demo: generate from existing notes
    const recentNotes = getRecentNotes(5)
      .map((note) => getNoteById(note.id))
      .filter((note): note is NoteDetailRow => Boolean(note?.rawText));

    if (recentNotes.length < 2) {
      return { skipped: true, reason: 'Not enough notes to evaluate' };
    }

    let hits = 0;
    const results: any[] = [];

    for (const note of recentNotes.slice(0, 3)) {
      // Generate a question from this note's content using Haiku
      const questionRes = await this.claude.messages.create({
        model: config.models.agent,
        max_tokens: 60,
        temperature: 0,
        system:
          'Generate one specific question that would be answered by this text. Output the question only.',
        messages: [{ role: 'user', content: note.rawText.slice(0, 400) }],
      });
      const question = String(
        (questionRes.content[0] as any).text ?? '',
      ).trim();

      // Embed the question and search
      const qvRes = await this.voyage.embed({
        input: [question],
        model: config.models.voyage,
      });
      if (!qvRes?.data?.[0]?.embedding) {
        throw new Error('Failed to embed question');
      }
      const qv = qvRes.data[0].embedding;

      const results_qdrant = await this.qdrant.search(config.collection, {
        vector: qv,
        limit: 4,
        with_payload: true,
        score_threshold: 0.65,
      });

      // Did the original note appear in results?
      const retrievedNoteIds = results_qdrant.map((r) => {
        const payloadId = r.payload?.noteId;
        return typeof payloadId === 'string' ? payloadId : '';
      });
      const hit = retrievedNoteIds.includes(note.id);
      if (hit) hits++;

      results.push({
        question: question.slice(0, 80),
        targetNote: note.title,
        hit,
        topScore: results_qdrant[0]?.score?.toFixed(3) || '0',
      });
    }

    const hitRate = ((hits / results.length) * 100).toFixed(0);

    return {
      hitRate: Number.parseInt(hitRate, 10),
      passing: Number.parseInt(hitRate, 10) >= 70,
      results,
      testedAt: new Date().toISOString(),
    };
  }

  // ── Answer quality eval (LLM-as-judge) ───────────────────
  async evalAnswerQuality(userId: string) {
    const recentNotes = getRecentNotes(3)
      .map((note) => getNoteById(note.id))
      .filter((note): note is NoteDetailRow => Boolean(note?.rawText));
    if (recentNotes.length < 1) return { skipped: true };

    const scores: number[] = [];

    for (const note of recentNotes.slice(0, 2)) {
      const context = note.rawText.slice(0, 600);

      // Generate a question
      const qRes = await this.claude.messages.create({
        model: config.models.agent,
        max_tokens: 60,
        temperature: 0,
        system:
          'Generate one specific question answered by this text. Output only the question.',
        messages: [{ role: 'user', content: context }],
      });
      const question = String((qRes.content[0] as any).text ?? '').trim();

      // Generate an answer
      const aRes = await this.claude.messages.create({
        model: config.models.chat,
        max_tokens: 300,
        system: `Answer ONLY from the provided context.\n\nCONTEXT:\n${context}`,
        messages: [{ role: 'user', content: question }],
      });
      const answer = String((aRes.content[0] as any).text ?? '');

      // Judge the answer
      const judgeRes = await this.claude.messages.create({
        model: config.models.agent,
        max_tokens: 60,
        temperature: 0,
        system:
          'Score this answer 1-5 for accuracy and grounding. Respond ONLY with JSON: {"score": N}',
        messages: [
          {
            role: 'user',
            content: `Context: ${context}\nQuestion: ${question}\nAnswer: ${answer}\nScore 1-5:`,
          },
        ],
      });

      try {
        const j = JSON.parse(String((judgeRes.content[0] as any).text ?? ''));
        scores.push(j.score);
      } catch {
        scores.push(3);
      }
    }

    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;

    return {
      avgScore: Number.parseFloat(avg.toFixed(1)),
      passing: avg >= 3.5,
      samples: scores.length,
      testedAt: new Date().toISOString(),
    };
  }
}
