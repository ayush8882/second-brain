import './load-env';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

/** Image ingest sends base64 in JSON; default Express limit is 100kb. */
const JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT ?? '50mb';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  app.useBodyParser('json', { limit: JSON_BODY_LIMIT });
  app.useBodyParser('urlencoded', { limit: JSON_BODY_LIMIT, extended: true });

  app.enableCors({ origin: '*' });

  app.setGlobalPrefix('api');

  await app.listen(process.env.PORT ?? 3000);

  console.log(`Server is running on port ${process.env.PORT ?? 3000}`);
}
bootstrap();
