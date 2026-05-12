import {
  Injectable,
  Logger,
  MessageEvent,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Subject } from 'rxjs';
import Anthropic from '@anthropic-ai/sdk';
import { VoyageAIClient } from 'voyageai';
import { VectorService } from '../vector/vector.service';
import { MemoryService } from '../memory/memory.service';
import { config } from '../config/config';
import { voyageEmbedOne } from '../embed/voyage-embed.util';
import type { VectorSearchHit } from '../vector/vector.types';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly claude: Anthropic | null;
  private readonly voyage: VoyageAIClient | null;

  constructor(
    private readonly vector: VectorService,
    private readonly memory: MemoryService,
  ) {
    this.claude = config.anthropicKey
      ? new Anthropic({ apiKey: config.anthropicKey })
      : null;
    this.voyage = config.voyageKey
      ? new VoyageAIClient({ apiKey: config.voyageKey })
      : null;
  }

  async ask(
    sessionId: string,
    question: string,
    subject: Subject<MessageEvent>,
  ): Promise<void> {
    const errPayload = (message: string) =>
      JSON.stringify({ type: 'error', message });

    try {
      if (!sessionId?.trim() || !question?.trim()) {
        this.logger.warn(
          'Ask rejected: sessionId and question are required',
        );
        subject.next({
          data: errPayload('sessionId and question are required'),
        });
        subject.complete();
        return;
      }

      if (!this.claude) {
        this.logger.warn('Ask rejected: ANTHROPIC_API_KEY is not set');
        subject.next({
          data: errPayload('ANTHROPIC_API_KEY is not set'),
        });
        subject.complete();
        return;
      }

      if (!this.voyage) {
        this.logger.warn('Ask rejected: VOYAGE_API_KEY is not set');
        subject.next({
          data: errPayload('VOYAGE_API_KEY is not set'),
        });
        subject.complete();
        return;
      }

      const queryVector = await voyageEmbedOne(this.voyage, question.trim());
      if (queryVector.length !== config.vectorSize) {
        throw new ServiceUnavailableException(
          `Embedding dimension mismatch: expected ${config.vectorSize}, got ${queryVector.length}.`,
        );
      }

      const chunks: VectorSearchHit[] = await this.vector.search({
        vector: queryVector,
      });

      if (chunks.length === 0) {
        this.logger.warn(
          'Ask: no relevant chunks above threshold (same as CLI "No relevant notes found")',
        );
        subject.next({ data: JSON.stringify({ type: 'no_context' }) });
        subject.complete();
        return;
      }

      chunks.forEach((c, i) => {
        this.logger.log(
          `Ask source [${i + 1}] "${c.title}" (${c.sourceType}) — relevance: ${((c.score ?? 0) * 100).toFixed(0)}%`,
        );
      });

      subject.next({
        data: JSON.stringify({
          type: 'sources',
          sources: chunks.map((c) => ({
            title: c.title,
            sourceType: c.sourceType,
            score: c.score,
          })),
        }),
      });

      const context = chunks
        .map((c, i) => `[${i + 1}] From "${c.title}":\n${c.text}`)
        .join('\n\n---\n\n');

      const messages = this.memory.buildMessages(sessionId, question.trim());

      let fullAnswer = '';

      const stream = this.claude.messages.stream({
        model: config.models.chat,
        max_tokens: 1024,
        system: `You are a personal knowledge assistant.
The user is querying their own saved notes and knowledge base.
Answer ONLY from the provided context — never invent information.
Be specific — reference the source titles when relevant.
If the context doesn't fully answer the question, say so clearly.

CONTEXT FROM NOTES:
${context}`,
        messages,
      });

      for await (const chunk of stream) {
        if (
          chunk.type === 'content_block_delta' &&
          chunk.delta.type === 'text_delta'
        ) {
          fullAnswer += chunk.delta.text;
          subject.next({
            data: JSON.stringify({ type: 'token', text: chunk.delta.text }),
          });
        }
      }

      const final = await stream.finalMessage();
      this.logger.log(
        `Ask completed: input_tokens=${final.usage.input_tokens} output_tokens=${final.usage.output_tokens}`,
      );
      subject.next({
        data: JSON.stringify({
          type: 'done',
          usage: final.usage,
        }),
      });

      this.memory.saveTurn(sessionId, question.trim(), fullAnswer);
      subject.complete();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Chat request failed';
      this.logger.error(`Ask failed: ${message}`, err instanceof Error ? err.stack : undefined);
      subject.next({
        data: errPayload(message),
      });
      subject.complete();
    }
  }
}
