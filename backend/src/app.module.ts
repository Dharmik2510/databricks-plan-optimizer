import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { AnalysisModule } from './modules/analysis/analysis.module';
import { ChatModule } from './modules/chat/chat.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { GeminiModule } from './integrations/gemini/gemini.module';
import { HealthModule } from './health/health.module';

import { RepositoryModule } from './modules/repository/repository.module';
import { AgentModule } from './modules/agent/agent.module';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // Rate limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('THROTTLE_TTL', 60000),
          limit: config.get<number>('THROTTLE_LIMIT', 100),
        },
      ],
    }),

    // Core modules
    PrismaModule,
    HealthModule,

    // Feature modules
    AuthModule,
    UsersModule,
    AnalysisModule,
    ChatModule,
    PricingModule,
    RepositoryModule,
    AgentModule,
    AdminModule,

    // Integration modules
    GeminiModule,
  ],
  providers: [
    // Global rate limiting guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule { }
