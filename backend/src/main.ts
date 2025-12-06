
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';
import * as fetch from 'node-fetch';

if (!globalThis.fetch) {
  globalThis.fetch = fetch as any;
  globalThis.Headers = (fetch as any).Headers;
  globalThis.Request = (fetch as any).Request;
  globalThis.Response = (fetch as any).Response;
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Security headers
  app.use(helmet());

  // CORS configuration
  const corsOrigin = configService.get<string>('CORS_ORIGIN', 'http://localhost:3000');
  app.enableCors({
    origin: corsOrigin.split(',').map(origin => origin.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global API prefix
  app.setGlobalPrefix('api/v1');

  const port = configService.get<number>('PORT', 3001);
  await app.listen(port);

  logger.log(`🚀 BrickOptima API running on http://localhost:${port}`);
  logger.log(`📚 API Prefix: /api/v1`);
  logger.log(`🔗 CORS Origin: ${corsOrigin}`);
}

bootstrap();
