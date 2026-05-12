import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { VoyageAIClient } from 'voyageai';
import { v4 as uuid } from 'uuid';
import { config } from '../config/config';
import { voyageEmbedBatch } from '../embed/voyage-embed.util';
import { chunkText } from './chunk-text';
import { parsePdf } from './parse-pdf';
import { parseUrl } from './parse-url';
import { insertNoteRow } from '../db';
import { VectorService } from '../vector/vector.service';
import type { UpsertVectorPoint } from '../vector/vector.types';

@Injectable()
export class IngestService {
  private readonly logger = new Logger(IngestService.name);
  private readonly voyage: VoyageAIClient | null;

  constructor(private readonly vectorService: VectorService) {
    this.voyage = config.voyageKey
      ? new VoyageAIClient({ apiKey: config.voyageKey })
      : null;
  }

  async ingestText(body: { title: string; text: string; tags?: string[] }) {
    if (!body.title?.trim()) {
      throw new BadRequestException('title is required');
    }
    return this.processAndStore(
      body.title.trim(),
      body.text ?? '',
      'text',
      'manual',
      body.tags ?? [],
    );
  }

  async ingestPdf(title: string, filePath: string, tags?: string[]) {
    if (!title?.trim()) {
      throw new BadRequestException('title is required');
    }
    if (!filePath?.trim()) {
      throw new BadRequestException('filePath is required');
    }
    try {
      const text = await parsePdf(filePath.trim());
      return this.processAndStore(
        title.trim(),
        text,
        'pdf',
        filePath.trim(),
        tags ?? [],
      );
    } catch (e) {
      this.rethrowIngestError(e);
    }
  }

  async ingestUrl(title: string, url: string, tags?: string[]) {
    if (!title?.trim()) {
      throw new BadRequestException('title is required');
    }
    if (!url?.trim()) {
      throw new BadRequestException('url is required');
    }
    try {
      const text = await parseUrl(url.trim());
      return this.processAndStore(
        title.trim(),
        text,
        'url',
        url.trim(),
        tags ?? [],
      );
    } catch (e) {
      this.rethrowIngestError(e);
    }
  }

  private rethrowIngestError(e: unknown): never {
    const msg = e instanceof Error ? e.message : 'Ingest failed';
    if (msg.startsWith('BAD_REQUEST:')) {
      throw new BadRequestException(msg.slice('BAD_REQUEST:'.length).trim());
    }
    throw new UnprocessableEntityException(msg);
  }

  /**
   * Same pipeline as top-level `src/ingest.js`: extract → chunk → embed batch → Qdrant → SQLite.
   */
  private async processAndStore(
    title: string,
    text: string,
    sourceType: string,
    sourceRef: string,
    tags: string[],
  ) {
    if (!this.voyage) {
      throw new ServiceUnavailableException(
        'VOYAGE_API_KEY is not set; cannot embed chunks.',
      );
    }

    const noteId = uuid();
    const tagsJson = JSON.stringify(tags);
    const rawText = text.trim();
    const chunks = chunkText(rawText);

    if (chunks.length === 0) {
      insertNoteRow(noteId, title, sourceType, sourceRef, 0, rawText, tagsJson);
      return { noteId, chunkCount: 0, title };
    }

    const client = this.voyage;
    const texts = chunks.map((c) => c.text);
    const embeddings = await voyageEmbedBatch(client, texts, (m) =>
      this.logger.log(m),
    );

    const points: UpsertVectorPoint[] = chunks.map((c, i) => {
      const vector = embeddings[i];
      if (vector?.length !== config.vectorSize) {
        throw new ServiceUnavailableException(
          `Embedding dimension mismatch: expected ${config.vectorSize}, got ${vector?.length ?? 0}. Check VOYAGE_FREE_TIER / model settings.`,
        );
      }
      return {
        id: uuid(),
        vector,
        payload: {
          noteId,
          title,
          text: c.text,
          chunkIndex: c.index,
          sourceType,
          sourceRef,
          tagsJson,
        },
      };
    });

    await this.vectorService.upsertChunks(points);

    insertNoteRow(
      noteId,
      title,
      sourceType,
      sourceRef,
      chunks.length,
      rawText,
      tagsJson,
    );

    return { noteId, chunkCount: chunks.length, title };
  }
}
