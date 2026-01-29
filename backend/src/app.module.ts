import { Module, MiddlewareConsumer, RequestMethod, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';

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
import { FeedbackModule } from './modules/feedback/feedback.module';
import { EducationModule } from './modules/education/education.module';
import { DbrModule } from './modules/dbr/dbr.module';
import { HistoricalModule } from './modules/historical/historical.module';
import { OrgConnectionsModule } from './modules/org-connections/org-connections.module';
import { DataSourcesModule } from './modules/datasources/datasources.module';

// Observability imports
import { LoggingModule } from './common/logging/logging.module';
import { MonitoringModule } from './common/monitoring/monitoring.module'; // Phase 5
import { SupabaseModule } from './common/supabase/supabase.module';
import { SecurityModule } from './common/security/security.module';
import { AuditModule } from './common/audit/audit.module';
import { RequestContextMiddleware } from './common/middleware/request-context.middleware';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AppLoggerService } from './common/logging/app-logger.service';
import { McpModule } from './integrations/mcp/mcp.module';
import { McpProxyModule } from './integrations/mcp-proxy/mcp-proxy.module';
import { QuotaModule } from './common/quota/quota.module';

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
    LoggingModule, // Observability: Global logging
    MonitoringModule, // Phase 5: Cloud Monitoring, Tracing, Custom Metrics
    SupabaseModule,
    SecurityModule,
    AuditModule,
    McpModule,
    McpProxyModule,
    QuotaModule,
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
    FeedbackModule,
    EducationModule,
    DbrModule,
    HistoricalModule,
    OrgConnectionsModule,
    DataSourcesModule,

    // Integration modules
    GeminiModule,
  ],
  providers: [
    // Global rate limiting guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Global logging interceptor
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    // Global exception filter
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply request context middleware to all routes
    consumer
      .apply(RequestContextMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
