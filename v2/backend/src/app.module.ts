import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ChatModule } from './chats/chat.module';
import { EvalsModule } from './evals/evals.module';
import { IngestModule } from './ingest/ingest.module';
import { NotesModule } from './notes/notes.module';
import { ObservabilityModule } from './observability/observability.module';

@Module({
  imports: [
    ObservabilityModule,
    IngestModule,
    NotesModule,
    ChatModule,
    EvalsModule,
  ],
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
