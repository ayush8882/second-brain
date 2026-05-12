import { Injectable } from '@nestjs/common';
import { VectorService } from '../vector/vector.service';
import { deleteNoteRow, getAllNotes, getNotesCount, type NoteRow } from '../db';

@Injectable()
export class NotesService {
  constructor(private readonly vector: VectorService) {}

  getAll(): NoteRow[] {
    return getAllNotes();
  }

  getStats(): { count: number } {
    return { count: getNotesCount() };
  }

  async delete(noteId: string) {
    await this.vector.deleteNoteChunks(noteId);
    deleteNoteRow(noteId);
    return { deleted: true };
  }
}
