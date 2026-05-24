import { Controller, Get, Headers } from '@nestjs/common';
import { EvalsService } from './evals.service';

@Controller('evals')
export class EvalsController {
  constructor(private readonly evals: EvalsService) {}

  @Get('run')
  async runEvals(@Headers('x-user-id') userId?: string) {
    const effectiveUserId = userId?.trim() || 'anonymous';
    const [retrieval, quality] = await Promise.all([
      this.evals.evalRetrieval(effectiveUserId),
      this.evals.evalAnswerQuality(effectiveUserId),
    ]);

    return {
      retrieval,
      quality,
      overall: {
        passing: retrieval.passing && quality.passing,
        summary: `Retrieval: ${retrieval.hitRate}% hit rate · Answer quality: ${quality.avgScore}/5`,
      },
    };
  }
}
