import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { QdrantClient } from '@qdrant/js-client-rest';
import { config } from '../config/config';
import type { UpsertVectorPoint } from './vector.types';

@Injectable()
export class VectorService implements OnModuleInit {
  private readonly logger = new Logger(VectorService.name);
  private collectionEnsured = false;

  constructor(private readonly qdrantClient: QdrantClient) {}

  async onModuleInit() {
    try {
      await this.ensureCollection();
      this.collectionEnsured = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Qdrant not reachable at ${config.qdrantUrl} (${msg}). API stays up; vector ingest will fail until Qdrant is running.`,
      );
    }
  }

  async ensureCollection() {
    const { collections } = await this.qdrantClient.getCollections();
    const exists = collections.some((c) => c.name === config.collection);

    if (!exists) {
      await this.qdrantClient.createCollection(config.collection, {
        vectors: {
          size: config.vectorSize,
          distance: 'Cosine',
        },
      });
    }
  }

  private async ensureCollectionReady(): Promise<void> {
    if (this.collectionEnsured) {
      return;
    }
    try {
      await this.ensureCollection();
      this.collectionEnsured = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new ServiceUnavailableException(
        `Qdrant at ${config.qdrantUrl} is not reachable (${msg}). Start Qdrant (e.g. docker run -p 6333:6333 qdrant/qdrant) or set QDRANT_URL.`,
      );
    }
  }

  async upsertChunks(chunks: UpsertVectorPoint[]) {
    if (chunks.length === 0) {
      return;
    }
    await this.ensureCollectionReady();
    await this.qdrantClient.upsert(config.collection, {
      points: chunks.map((chunk) => ({
        id: chunk.id,
        vector: chunk.vector,
        payload: chunk.payload,
      })),
    });
  }

  async search(query: { vector: number[] }, topK: number = config.rag.topK) {
    await this.ensureCollectionReady();
    const results = await this.qdrantClient.search(config.collection, {
      vector: query.vector,
      limit: topK,
      with_payload: true,
      score_threshold: config.rag.scoreThreshold,
    });
    return results.map((r) => r.payload);
  }

  async deleteNoteChunks(noteId: string) {
    await this.ensureCollectionReady();
    await this.qdrantClient.delete(config.collection, {
      filter: {
        must: [{ key: 'noteId', match: { value: noteId } }],
      },
    });
  }
}
