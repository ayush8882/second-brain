import { Injectable } from '@nestjs/common';
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages';

const MAX_MESSAGES = 24;

@Injectable()
export class MemoryService {
  private readonly history = new Map<string, MessageParam[]>();

  buildMessages(sessionId: string, question: string): MessageParam[] {
    const prev = this.history.get(sessionId) ?? [];
    return [...prev, { role: 'user', content: question }];
  }

  saveTurn(sessionId: string, question: string, answer: string): void {
    const prev = this.history.get(sessionId) ?? [];
    const next: MessageParam[] = [
      ...prev,
      { role: 'user', content: question },
      { role: 'assistant', content: answer },
    ];
    this.history.set(sessionId, next.slice(-MAX_MESSAGES));
  }
}
