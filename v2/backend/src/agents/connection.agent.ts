import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuid } from 'uuid';
import { config } from '../config/config';
import {
  getNoteById,
  insertConnectionRow,
  type NoteDetailRow,
} from '../db';
import { VectorService } from '../vector/vector.service';

function formatAgentError(err: unknown): string {
  if (err instanceof Error) {
    const extra = err as Error & { status?: number; error?: unknown };
    const status =
      typeof extra.status === 'number' ? ` (HTTP ${extra.status})` : '';
    const detail =
      extra.error != null ? ` — ${JSON.stringify(extra.error)}` : '';
    return `${err.message}${status}${detail}`;
  }
  return String(err);
}

type RelatedNote = {
  noteId: string;
  title: string;
  score: number;
  snippet: string;
  fullText: string;
};

@Injectable()
export class ConnectionAgent {
  private readonly logger = new Logger(ConnectionAgent.name);
  private readonly anthropic: Anthropic | null;

  constructor(private readonly vectorService: VectorService) {
    this.anthropic = config.anthropicKey
      ? new Anthropic({ apiKey: config.anthropicKey })
      : null;
  }

  /** Called after ingest — non-blocking; failures are logged only. */
  async run(noteId: string, noteVector: number[]): Promise<void> {
    if (!this.anthropic) {
      this.logger.debug('ANTHROPIC_API_KEY not set — skipping connections');
      return;
    }

    try {
      const relatedNotes = await this.searchAgent(noteId, noteVector);
      if (relatedNotes.length === 0) {
        this.logger.log('No related notes found — skipping synthesis');
        return;
      }

      this.logger.log(`Found ${relatedNotes.length} related notes`);

      const newNote = getNoteById(noteId);
      if (!newNote) {
        this.logger.warn(`Note ${noteId} not found in SQLite`);
        return;
      }

      const insight = await this.synthesisAgent(newNote, relatedNotes);

      insertConnectionRow({
        id: uuid(),
        noteId,
        relatedIds: JSON.stringify(relatedNotes.map((n) => n.noteId)),
        insight,
      });

      this.logger.log('Insight saved');
    } catch (err) {
      const msg = formatAgentError(err);
      this.logger.error(`Connections agent error (non-fatal): ${msg}`);
    }
  }

  private async searchAgent(
    noteId: string,
    noteVector: number[],
  ): Promise<RelatedNote[]> {
    const results = await this.vectorService.searchExcluding(
      noteVector,
      noteId,
      8,
    );

    const seen = new Set<string>();
    const uniqueNotes: RelatedNote[] = [];

    for (const result of results) {
      if (seen.has(result.noteId)) continue;
      seen.add(result.noteId);

      const note = getNoteById(result.noteId);
      if (!note) continue;

      uniqueNotes.push({
        noteId: result.noteId,
        title: result.title,
        score: result.score,
        snippet: result.text.slice(0, 300),
        fullText: note.rawText.slice(0, 800),
      });

      if (uniqueNotes.length >= 3) break;
    }

    return uniqueNotes;
  }

  private async synthesisAgent(
    newNote: NoteDetailRow,
    relatedNotes: RelatedNote[],
  ): Promise<string> {
    const relatedContext = relatedNotes
      .map(
        (n, i) =>
          `[Related Note ${i + 1}: "${n.title}" — ${(n.score * 100).toFixed(0)}% match]\n${n.fullText}`,
      )
      .join('\n\n---\n\n');

    const response = await this.anthropic!.messages.create({
      model: config.models.agent,
      max_tokens: 300,
      temperature: 0,
      system: `You are a knowledge connection analyst.
Your job is to find meaningful connections between a new note and existing notes.
Be specific and insightful — not generic.
Focus on: shared themes, contradictions, complementary ideas, or knowledge gaps.
Write 2-3 sentences maximum. Be direct. No preamble like "I notice that..."`,
      messages: [
        {
          role: 'user',
          content: `NEW NOTE: "${newNote.title}"
${newNote.rawText.slice(0, 600)}

RELATED NOTES FROM KNOWLEDGE BASE:
${relatedContext}

Generate a brief insight about how the new note connects to, contradicts, or extends the related notes.`,
        },
      ],
    });

    const block = response.content[0];
    if (block?.type !== 'text') {
      return 'Could not generate connection insight.';
    }
    return block.text.trim();
  }
}
