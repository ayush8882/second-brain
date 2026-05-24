import { Controller, Get, Headers } from '@nestjs/common';
import { CostMonitorService } from './cost-monitor.service';

@Controller('stats')
export class CostController {
  constructor(private readonly costMonitor: CostMonitorService) {}

  @Get()
  async getStats(@Headers('x-user-id') userId?: string) {
    return this.costMonitor.getStats(userId?.trim() || 'anonymous');
  }
}
