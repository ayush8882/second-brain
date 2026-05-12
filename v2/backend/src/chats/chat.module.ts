import { Module } from '@nestjs/common';
import { VectorModule } from '../vector/vector.module';
import { MemoryService } from '../memory/memory.service';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  imports: [VectorModule],
  controllers: [ChatController],
  providers: [ChatService, MemoryService],
})
export class ChatModule {}
