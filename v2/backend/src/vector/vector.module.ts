import { Module } from '@nestjs/common';
import { QdrantClient } from '@qdrant/js-client-rest';
import { config } from '../config/config';
import { VectorService } from './vector.service';

@Module({
  providers: [
    {
      provide: QdrantClient,
      useFactory: () =>
        new QdrantClient({
          url: config.qdrantUrl,
          apiKey: config.qdrantApiKey,
          checkCompatibility: false,
        }),
    },
    VectorService,
  ],
  exports: [VectorService, QdrantClient],
})
export class VectorModule {}
