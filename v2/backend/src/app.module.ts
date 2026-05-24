import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ChatModule } from './chats/chat.module';
import { IngestModule } from './ingest/ingest.module';
import { NotesModule } from './notes/notes.module';
import { ObservabilityModule } from './observability/observability.module';
import { ObservabilityInterceptor } from './observability/observability.interceptor';

@Module({
  imports: [ObservabilityModule, IngestModule, NotesModule, ChatModule],
  controllers: [AppController],
  providers: [
    AppService,
    // {
    //   provide: APP_INTERCEPTOR,
    //   useClass: ObservabilityInterceptor,
    // },
  ],
})
export class AppModule {}
