import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { getRequestContext } from '../common/middleware/request-context.middleware';

/**
 * Production-ready Prisma service
 * - Automatic user-scoped queries (multi-user isolation)
 * - Query logging and performance monitoring
 * - Graceful connection handling
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'info' },
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      ],
    });
  }

  async onModuleInit() {
    const maxRetries = 5;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        await this.$connect();
        this.logger.log('✅ Database connected successfully');

        // Add user isolation middleware
        this.setupUserIsolationMiddleware();
        return;
      } catch (error) {
        retryCount++;
        this.logger.error(`❌ Database connection failed (Attempt ${retryCount}/${maxRetries}): ${error.message}`);

        if (retryCount >= maxRetries) {
          this.logger.error('CRITICAL: All database connection attempts failed');
          // Don't throw - let the app start but log critical failure. 
          // Readiness probes should handle this.
          break;
        }

        // Exponential backoff: 1s, 2s, 4s, 8s...
        const delay = Math.pow(2, retryCount - 1) * 1000;
        this.logger.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }

  /**
   * Setup middleware for user-scoped data isolation
   * Automatically filters queries by userId from request context
   * CRITICAL for multi-user security and data isolation
   */
  private setupUserIsolationMiddleware() {
    // Models that should be scoped by userId
    const userScopedModels = [
      'Analysis',
      'ChatSession',
      'Repository',
      'RefreshToken',
      'UserSession',
      'RequestAudit',
      'WorkflowRun',
      'UserFeedback',
    ];

    // Models that should NOT be auto-scoped (system models)
    const systemModels = [
      'User',
      'PricingCache',
      'checkpoint_blobs',
      'checkpoint_migrations',
      'checkpoint_writes',
      'checkpoints',
      'RepoSnapshot',
      'ChatMessage',
      'WorkflowEvent',
      'FeedbackAttachment',
      'FeedbackEvent',
    ];

    this.$use(async (params, next) => {
      const context = getRequestContext();

      // Skip if no user context (unauthenticated requests)
      if (!context?.userId) {
        return next(params);
      }

      // Skip system models
      if (!params.model || systemModels.includes(params.model)) {
        return next(params);
      }

      // Apply user scoping for read operations
      if (
        userScopedModels.includes(params.model) &&
        (params.action === 'findFirst' ||
          params.action === 'findMany' ||
          params.action === 'findUnique' ||
          params.action === 'count')
      ) {
        params.args = params.args || {};
        params.args.where = {
          ...params.args.where,
          userId: context.userId,
        };
      }

      // Apply user scoping for write operations
      if (
        userScopedModels.includes(params.model) &&
        params.action === 'create'
      ) {
        params.args = params.args || {};
        params.args.data = {
          ...params.args.data,
          userId: context.userId,
        };
      }

      // Verify ownership for update/delete operations
      if (
        userScopedModels.includes(params.model) &&
        (params.action === 'update' ||
          params.action === 'delete' ||
          params.action === 'updateMany' ||
          params.action === 'deleteMany')
      ) {
        params.args = params.args || {};
        params.args.where = {
          ...params.args.where,
          userId: context.userId,
        };
      }

      return next(params);
    });
  }

  // Helper method for cleaning up test data
  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot clean database in production!');
    }

    const models = Reflect.ownKeys(this).filter(
      (key) => typeof key === 'string' && key[0] !== '_' && key[0] !== '$',
    );

    return Promise.all(
      models.map((modelKey) => {
        const model = (this as any)[modelKey as string];
        if (model && typeof model.deleteMany === 'function') {
          return model.deleteMany();
        }
        return Promise.resolve();
      }),
    );
  }
}
