import { Controller, Post, Body } from '@nestjs/common';
import { IngestService } from './ingest.service';

@Controller('ingest')
export class IngestController {
  constructor(private readonly ingestService: IngestService) {}

  @Post('text')
  async ingestText(
    @Body() body: { title: string; text: string; tags?: string[] },
  ) {
    return this.ingestService.ingestText(body);
  }

  @Post('pdf')
  async ingestPdf(
    @Body() body: { title: string; filePath: string; tags?: string[] },
  ) {
    return this.ingestService.ingestPdf(
      body.title,
      body.filePath,
      body.tags,
    );
  }

  @Post('url')
  async ingestUrl(@Body() body: { title: string; url: string; tags?: string[] }) {
    return this.ingestService.ingestUrl(body.title, body.url, body.tags);
  }
}
