import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { mkdirSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { v4 as uuid } from 'uuid';
import { config } from '../config/config';
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
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dir = config.ingestFilesRoot;
          mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, _file, cb) => {
          cb(null, `${uuid()}.pdf`);
        },
      }),
      limits: { fileSize: 25 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ok =
          file.mimetype === 'application/pdf' ||
          file.originalname.toLowerCase().endsWith('.pdf');
        if (!ok) {
          cb(new BadRequestException('Only PDF uploads are allowed'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async ingestPdf(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('title') title: string,
  ) {
    if (!title?.trim()) {
      throw new BadRequestException('title is required');
    }
    if (!file?.path) {
      throw new BadRequestException('file is required');
    }
    try {
      return await this.ingestService.ingestPdf(title.trim(), file.path);
    } finally {
      await unlink(file.path).catch(() => undefined);
    }
  }

  @Post('url')
  async ingestUrl(
    @Body() body: { title: string; url: string; tags?: string[] },
  ) {
    return this.ingestService.ingestUrl(body.title, body.url, body.tags);
  }
}
