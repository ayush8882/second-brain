import { Controller, MessageEvent, Query, Sse } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Sse('ask')
  ask(
    @Query('sessionId') sessionId: string,
    @Query('question') question: string,
  ): Observable<MessageEvent> {
    const subject = new Subject<MessageEvent>();
    void this.chat.ask(sessionId ?? '', question ?? '', subject);
    return subject.asObservable();
  }
}
