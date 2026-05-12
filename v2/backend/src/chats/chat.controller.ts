import {
  Controller,
  Get,
  Logger,
  MessageEvent,
  Query,
  Sse,
} from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(private readonly chat: ChatService) {}

  @Get('ask')
  @Sse()
  ask(
    @Query('sessionId') sessionId: string = '',
    @Query('question') question: string = '',
  ): Observable<MessageEvent> {
    this.logger.log(
      `GET /api/chat/ask received sessionId=${JSON.stringify(sessionId)} question=${JSON.stringify(question)}`,
    );
    const subject = new Subject<MessageEvent>();
    void this.chat.ask(sessionId, question, subject);
    return subject.asObservable();
  }
}
