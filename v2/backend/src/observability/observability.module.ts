import { Module } from '@nestjs/common';
import { MemoryRedisService } from './memory-redis.service';
import { CostController } from './cost.controller';
import { CostMonitorService } from './cost-monitor.service';
import { ObservabilityInterceptor } from './observability.interceptor';
import { RateLimiterService } from './rate-limiter.service';
import { REDIS_CLIENT } from './redis.types';

@Module({
  controllers: [CostController],
  providers: [
    MemoryRedisService,
    {
      provide: REDIS_CLIENT,
      useExisting: MemoryRedisService,
    },
    RateLimiterService,
    CostMonitorService,
    ObservabilityInterceptor,
  ],
  exports: [
    REDIS_CLIENT,
    MemoryRedisService,
    RateLimiterService,
    CostMonitorService,
    ObservabilityInterceptor,
  ],
})
export class ObservabilityModule {}
