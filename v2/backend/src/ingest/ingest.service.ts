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
import { createReadStream } from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import { DeepgramClient } from '@deepgram/sdk';
import { ConnectionAgent } from '../agents/connection.agent';
import {
  normalizeImageInputs,
  summarizeImageSources,
} from './image-input';
import type { ImageBlockParam } from '@anthropic-ai/sdk/resources/messages';
import type { TextBlockParam } from '@anthropic-ai/sdk/resources/messages';

@Injectable()
export class IngestService {
  private readonly logger = new Logger(IngestService.name);
  private readonly voyage: VoyageAIClient | null;

  constructor(
    private readonly vectorService: VectorService,
    private readonly connectionsAgent: ConnectionAgent,
  ) {
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

  async ingestVoice(filePath: string, title?: string, tags?: string[]) {
    if (!filePath?.trim()) {
      throw new BadRequestException('filePath is required');
    }
    try {
      const text = await this.transcribeVoice(filePath.trim());
      let noteTitle = title?.trim() ?? '';
      if (!noteTitle) {
        noteTitle = config.anthropicKey
          ? await this.generateTitle(text)
          : text.trim().slice(0, 80) || 'Voice note';
      }
      return this.processAndStore(
        noteTitle,
        text,
        'voice',
        filePath.trim(),
        tags ?? [],
      );
    } catch (e) {
      this.rethrowIngestError(e);
    }
  }

  /**
   * Vision ingest: each item may be an HTTP(S) image URL, a data URI
   * (`data:image/png;base64,...`), or raw base64 (JPEG/PNG/GIF/WebP).
   */
  async ingestImages(body: {
    title?: string;
    images: string[];
    tags?: string[];
  }) {
    const images = body.images?.map((i) => i.trim()).filter(Boolean) ?? [];
    if (images.length === 0) {
      throw new BadRequestException('images are required');
    }
    try {
      const text = await this.describeImages(images);
      let title = body.title?.trim() ?? '';
      if (!title) {
        title = config.anthropicKey
          ? await this.generateImageTitle(text)
          : text.trim().slice(0, 80) || 'Image note';
      }
      return this.processAndStore(
        title,
        text,
        'image',
        summarizeImageSources(images),
        body.tags ?? [],
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

    // ── Trigger connections agent — non-blocking ──────────────
    // Use the first chunk's vector as representative of the note
    // Don't await — let it run in background, never block the response
    if (embeddings.length > 0) {
      this.connectionsAgent
        .run(noteId, embeddings[0]!)
        .catch((err) =>
          console.error('Connections agent failed silently:', err),
        );
    }

    return { noteId, chunkCount: chunks.length, title };
  }

  private async transcribeVoice(filePath: string): Promise<string> {
    if (!config.deepgramApiKey) {
      throw new ServiceUnavailableException(
        'DEEPGRAM_API_KEY is not set; cannot transcribe voice.',
      );
    }
    const deepgram = new DeepgramClient({ apiKey: config.deepgramApiKey });
    const result = await deepgram.listen.v1.media.transcribeFile(
      createReadStream(filePath),
      { model: 'nova-2', smart_format: true, language: 'en-IN' },
    );
    if (!('results' in result) || !result.results?.channels?.length) {
      throw new UnprocessableEntityException(
        'Transcription returned no results; check audio format or try again.',
      );
    }
    const alt = result.results.channels[0]?.alternatives?.[0];
    const transcript = alt?.transcript?.trim() ?? '';
    if (!transcript) {
      throw new UnprocessableEntityException(
        'Transcription was empty; audio may be silent or unreadable.',
      );
    }
    return transcript;
  }

  private async generateTitle(transcript: string): Promise<string> {
    if (!config.anthropicKey) {
      throw new ServiceUnavailableException(
        'ANTHROPIC_API_KEY is not set; cannot generate title.',
      );
    }
    const claude = new Anthropic({ apiKey: config.anthropicKey });
    const res = await claude.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 20,
      temperature: 0,
      system:
        'Generate a short 4-6 word title for this voice note. Output the title only. No quotes.',
      messages: [{ role: 'user', content: transcript.slice(0, 300) }],
    });
    const block = res.content[0];
    if (block?.type !== 'text') {
      throw new UnprocessableEntityException(
        'Could not generate a title from the transcript.',
      );
    }
    return block.text.trim();
  }

  private async describeImages(images: string[]): Promise<string> {
    if (!config.anthropicKey) {
      throw new ServiceUnavailableException(
        'ANTHROPIC_API_KEY is not set; cannot process images.',
      );
    }

    const imageBlocks = normalizeImageInputs(images);
    const claude = new Anthropic({ apiKey: config.anthropicKey });
    const count = imageBlocks.length;

    const prompt: TextBlockParam = {
      type: 'text',
      text:
        count === 1
          ? `Describe this image in detail for a personal knowledge base. Include: main subjects, visible text (transcribe accurately), UI elements, diagrams, colors, layout, and any facts or data shown. Write dense, search-friendly prose.`
          : `You are given ${count} images, in order (Image 1 through Image ${count}). For each image, write a detailed section headed "## Image N" covering: main subjects, all visible text (transcribe accurately), UI/diagrams, colors, layout, and facts shown. Separate sections with a blank line. Write dense, search-friendly prose.`,
    };

    const content: Array<TextBlockParam | ImageBlockParam> = [
      prompt,
      ...imageBlocks,
    ];

    const res = await claude.messages.create({
      model: config.models.chat,
      max_tokens: 4096,
      temperature: 0,
      messages: [{ role: 'user', content }],
    });

    const block = res.content.find((b) => b.type === 'text');
    if (!block || block.type !== 'text') {
      throw new UnprocessableEntityException(
        'Could not generate a description for the image(s).',
      );
    }
    const text = block.text.trim();
    if (!text) {
      throw new UnprocessableEntityException(
        'Image description was empty; try a clearer image or different format.',
      );
    }
    return text;
  }

  private async generateImageTitle(description: string): Promise<string> {
    if (!config.anthropicKey) {
      throw new ServiceUnavailableException(
        'ANTHROPIC_API_KEY is not set; cannot generate title.',
      );
    }
    const claude = new Anthropic({ apiKey: config.anthropicKey });
    const res = await claude.messages.create({
      model: config.models.agent,
      max_tokens: 20,
      temperature: 0,
      system:
        'Generate a short 4-6 word title for this image note based on the description. Output the title only. No quotes.',
      messages: [{ role: 'user', content: description.slice(0, 500) }],
    });
    const block = res.content[0];
    if (block?.type !== 'text') {
      throw new UnprocessableEntityException(
        'Could not generate a title from the image description.',
      );
    }
    return block.text.trim();
  }
}
