import { Controller, Delete, Get, Param } from '@nestjs/common';
import { NotesService } from './notes.service';

@Controller('notes')
export class NotesController {
  constructor(private readonly notes: NotesService) {}

  @Get()
  getAll() {
    return this.notes.getAll();
  }

  @Get('stats')
  getStats() {
    return this.notes.getStats();
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.notes.delete(id);
  }
}
