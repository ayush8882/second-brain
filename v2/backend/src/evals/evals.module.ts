import { Module } from '@nestjs/common';
import { VectorModule } from '../vector/vector.module';
import { EvalsController } from './evals.controller';
import { EvalsService } from './evals.service';

@Module({
  imports: [VectorModule],
  controllers: [EvalsController],
  providers: [EvalsService],
})
export class EvalsModule {}
