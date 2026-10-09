import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { validateRuntimeEnvironment } from './config/env';

async function bootstrap() {
  const runtime = validateRuntimeEnvironment();
  // rawBody: needed to verify webhook signatures (LINE x-line-signature) over the exact bytes received.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true, rawBody: true });
  // Academy practice photos are sent as base64 (max 5 MB image); everything else stays small.
  app.useBodyParser('json', { limit: '8mb' });
  const express = app.getHttpAdapter().getInstance();

  express.disable('x-powered-by');
  if (runtime.trustProxyHops > 0) express.set('trust proxy', runtime.trustProxyHops);

  app.enableCors({
    origin: runtime.corsOrigins.length > 0 ? runtime.corsOrigins : true,
    credentials: false,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key']
  });
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidUnknownValues: true
  }));
  app.enableShutdownHooks();

  await app.listen(runtime.port, '0.0.0.0');
  Logger.log(`AngelOS API listening on ${runtime.port} (${runtime.environment})`);
}

bootstrap().catch((error) => {
  Logger.error('AngelOS API failed to start', error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
