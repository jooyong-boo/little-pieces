import 'reflect-metadata';
import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT ?? 4000);
  const rawCorsOrigin = process.env.CORS_ORIGIN;
  const corsOrigin = rawCorsOrigin
    ? rawCorsOrigin
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
    : true;

  // TODO: 운영 배포 시 CORS_ORIGIN을 필수로 강제하고, 서비스 도메인만 허용하도록 조정.
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  await app.listen(port);
}

void bootstrap();
