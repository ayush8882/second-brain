import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ChatModule } from './chats/chat.module';
import { IngestModule } from './ingest/ingest.module';
import { NotesModule } from './notes/notes.module';

@Module({
  imports: [IngestModule, NotesModule, ChatModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
