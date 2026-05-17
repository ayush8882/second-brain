import { Module } from '@nestjs/common';
import { VectorModule } from '../vector/vector.module';
import { NotesController } from './notes.controller';
import { NotesService } from './notes.service';
import { ConnectionAgent } from 'src/agents/connection.agent';

@Module({
  imports: [VectorModule],
  controllers: [NotesController],
  providers: [NotesService, ConnectionAgent],
})
export class NotesModule {}
