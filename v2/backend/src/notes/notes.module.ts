import { Module } from '@nestjs/common';
import { VectorModule } from '../vector/vector.module';
import { NotesController } from './notes.controller';
import { NotesService } from './notes.service';

@Module({
  imports: [VectorModule],
  controllers: [NotesController],
  providers: [NotesService],
})
export class NotesModule {}
