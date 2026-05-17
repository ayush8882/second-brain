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

  @Get('connections/recent')
  getRecentConnections() {
    return this.notes.getRecentConnections();
  }

  @Get(':id/connections')
  getConnections(@Param('id') id: string) {
    return this.notes.getConnections(id);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.notes.delete(id);
  }
}
