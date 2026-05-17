import { Module } from '@nestjs/common';
import { VectorModule } from '../vector/vector.module';
import { IngestController } from './ingest.controller';
import { IngestService } from './ingest.service';
import { ConnectionAgent } from 'src/agents/connection.agent';

@Module({
  imports: [VectorModule],
  controllers: [IngestController],
  providers: [IngestService, ConnectionAgent],
})
export class IngestModule {}
