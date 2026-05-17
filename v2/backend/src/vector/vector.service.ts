import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { QdrantClient } from '@qdrant/js-client-rest';
import { config } from '../config/config';
import type {
  ChunkPayload,
  UpsertVectorPoint,
  VectorSearchHit,
} from './vector.types';

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

  /** Reads vector `size` from Qdrant's single-vector or first named-vector config. */
  private readDeclaredVectorSize(vectors: unknown): number | null {
    if (!vectors || typeof vectors !== 'object') {
      return null;
    }
    const obj = vectors as Record<string, unknown>;
    if (typeof obj.size === 'number') {
      return obj.size;
    }
    for (const val of Object.values(obj)) {
      if (
        val &&
        typeof val === 'object' &&
        typeof (val as { size?: unknown }).size === 'number'
      ) {
        return (val as { size: number }).size;
      }
    }
    return null;
  }

  async ensureCollection() {
    const { collections } = await this.qdrantClient.getCollections();
    const exists = collections.some((c) => c.name === config.collection);

    if (exists) {
      const info = await this.qdrantClient.getCollection(config.collection);
      const declared = this.readDeclaredVectorSize(
        info.config?.params?.vectors,
      );
      if (declared != null && declared !== config.vectorSize) {
        this.logger.warn(
          `Collection "${config.collection}" uses vector size ${declared}; app config expects ${config.vectorSize} (Voyage model / VOYAGE_FREE_TIER). Deleting and recreating the collection; existing vectors are removed.`,
        );
        await this.qdrantClient.deleteCollection(config.collection);
      } else {
        await this.ensureNoteIdPayloadIndex();
        return;
      }
    }

    await this.qdrantClient.createCollection(config.collection, {
      vectors: {
        size: config.vectorSize,
        distance: 'Cosine',
      },
    });
    await this.ensureNoteIdPayloadIndex();
  }

  /** Required for filter/must_not on `noteId` (connections agent, note delete). */
  private async ensureNoteIdPayloadIndex(): Promise<void> {
    try {
      await this.qdrantClient.createPayloadIndex(config.collection, {
        field_name: 'noteId',
        field_schema: 'keyword',
      });
      this.logger.log(`Payload index created on "${config.collection}.noteId"`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/already exists|AlreadyExists/i.test(msg)) {
        return;
      }
      this.logger.warn(
        `Could not create noteId payload index (filters may fail): ${msg}`,
      );
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

  async search(
    query: { vector: number[] },
    topK: number = config.rag.topK,
  ): Promise<VectorSearchHit[]> {
    await this.ensureCollectionReady();
    const results = await this.qdrantClient.search(config.collection, {
      vector: query.vector,
      limit: topK,
      with_payload: true,
      score_threshold: config.rag.scoreThreshold,
    });
    return results
      .filter((r) => r.payload != null)
      .map((r) => ({
        ...(r.payload as ChunkPayload),
        score: r.score,
      }));
  }

  async deleteNoteChunks(noteId: string) {
    await this.ensureCollectionReady();
    await this.qdrantClient.delete(config.collection, {
      filter: {
        must: [{ key: 'noteId', match: { value: noteId } }],
      },
    });
  }

  /** Similarity search for connection discovery; excludes the source note's chunks. */
  async searchExcluding(
    queryVector: number[],
    excludeNoteId: string,
    topK = 8,
  ): Promise<VectorSearchHit[]> {
    await this.ensureCollectionReady();
    const results = await this.qdrantClient.search(config.collection, {
      vector: queryVector,
      limit: topK,
      with_payload: true,
      score_threshold: config.rag.scoreThreshold,
      filter: {
        must_not: [{ key: 'noteId', match: { value: excludeNoteId } }],
      },
    });

    return results
      .filter((r) => r.payload != null)
      .map((r) => ({
        ...(r.payload as ChunkPayload),
        score: r.score,
      }));
  }
}
