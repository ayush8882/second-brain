import { Injectable } from '@nestjs/common';
import { VectorService } from '../vector/vector.service';
import {
  deleteNoteRow,
  getAllNotes,
  getConnectionByNoteId,
  getNotesCount,
  getRecentConnections,
  type NoteRow,
} from '../db';

export type NoteConnectionResponse =
  | { found: false }
  | {
      found: true;
      insight: string;
      relatedIds: string[];
      createdAt: string;
    };

export type RecentConnectionResponse = {
  id: string;
  noteId: string;
  noteTitle: string;
  insight: string;
  relatedIds: string[];
  createdAt: string;
};

@Injectable()
export class NotesService {
  constructor(private readonly vector: VectorService) {}

  getAll(): NoteRow[] {
    return getAllNotes();
  }

  getStats(): { count: number } {
    return { count: getNotesCount() };
  }

  getConnections(noteId: string): NoteConnectionResponse {
    const connection = getConnectionByNoteId(noteId);
    if (!connection) {
      return { found: false };
    }

    let relatedIds: string[] = [];
    try {
      relatedIds = JSON.parse(connection.relatedIds) as string[];
    } catch {
      relatedIds = [];
    }

    return {
      found: true,
      insight: connection.insight,
      relatedIds,
      createdAt: connection.createdAt,
    };
  }

  getRecentConnections(): RecentConnectionResponse[] {
    return getRecentConnections().map((c) => {
      let relatedIds: string[] = [];
      try {
        relatedIds = JSON.parse(c.relatedIds) as string[];
      } catch {
        relatedIds = [];
      }
      return {
        id: c.id,
        noteId: c.noteId,
        noteTitle: c.noteTitle ?? '',
        insight: c.insight,
        relatedIds,
        createdAt: c.createdAt,
      };
    });
  }

  async delete(noteId: string) {
    await this.vector.deleteNoteChunks(noteId);
    deleteNoteRow(noteId);
    return { deleted: true };
  }
}
