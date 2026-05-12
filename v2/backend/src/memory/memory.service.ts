import { Injectable } from '@nestjs/common';
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages';

/** Matches top-level `src/memory.js` sliding window (6 turns = 12 messages). */
const MAX_RECENT_TURNS = 6;

type SessionState = {
  messages: MessageParam[];
  summary: string;
};

@Injectable()
export class MemoryService {
  private readonly sessions = new Map<string, SessionState>();

  private getSession(sessionId: string): SessionState {
    let s = this.sessions.get(sessionId);
    if (!s) {
      s = { messages: [], summary: '' };
      this.sessions.set(sessionId, s);
    }
    return s;
  }

  buildMessages(sessionId: string, question: string): MessageParam[] {
    const session = this.getSession(sessionId);
    const messages: MessageParam[] = [];

    if (session.summary) {
      messages.push(
        {
          role: 'user',
          content: `[Earlier conversation: ${session.summary}]`,
        },
        {
          role: 'assistant',
          content:
            'Understood, I have context from our earlier conversation.',
        },
      );
    }

    messages.push(...session.messages, {
      role: 'user',
      content: question,
    });
    return messages;
  }

  saveTurn(sessionId: string, question: string, answer: string): void {
    const session = this.getSession(sessionId);
    session.messages.push(
      { role: 'user', content: question },
      { role: 'assistant', content: answer },
    );

    const maxMessages = MAX_RECENT_TURNS * 2;
    if (session.messages.length > maxMessages) {
      session.messages.splice(0, 2);
    }
  }
}
