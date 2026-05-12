export type ChunkPayload = {
  noteId: string;
  title: string;
  text: string;
  chunkIndex: number;
  sourceType: string;
  sourceRef: string;
  tagsJson: string;
};

export type UpsertVectorPoint = {
  id: string;
  vector: number[];
  payload: ChunkPayload;
};

export type VectorSearchHit = ChunkPayload & { score: number };
