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
    this.logger.log('🔌 Initializing database connection...');
    const maxRetries = 5;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        this.logger.log(`📡 Attempting database connection (Attempt ${retryCount + 1}/${maxRetries})...`);
        await this.$connect();
        this.logger.log('✅ Database connected successfully');

        // Add user isolation middleware
        try {
          this.logger.log('🔒 Setting up user isolation middleware...');
          this.setupUserIsolationMiddleware();
          this.logger.log('✅ User isolation middleware configured');
        } catch (error) {
          this.logger.error('❌ Failed to setup user isolation middleware', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          });
          throw error;
        }

        this.logger.log('🎉 Database module initialized successfully');
        return;
      } catch (error) {
        retryCount++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;

        this.logger.error(`❌ Database connection failed (Attempt ${retryCount}/${maxRetries})`, {
          error: errorMessage,
          stack: errorStack,
          attempt: retryCount,
          maxRetries,
        });

        if (retryCount >= maxRetries) {
          this.logger.error('🚨 CRITICAL: All database connection attempts failed', {
            totalAttempts: maxRetries,
            lastError: errorMessage,
            stack: errorStack,
          });
          // Don't throw - let the app start but log critical failure.
          // Readiness probes should handle this.
          break;
        }

        // Exponential backoff: 1s, 2s, 4s, 8s...
        const delay = Math.pow(2, retryCount - 1) * 1000;
        this.logger.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  async onModuleDestroy() {
    try {
      this.logger.log('🔌 Disconnecting from database...');
      await this.$disconnect();
      this.logger.log('✅ Database disconnected successfully');
    } catch (error) {
      this.logger.error('❌ Error during database disconnection', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Don't throw - we're shutting down anyway
    }
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

    this.logger.log(`🔒 User-scoped models: ${userScopedModels.join(', ')}`);
    this.logger.log(`🌐 System models (no user scoping): ${systemModels.join(', ')}`);

    this.$use(async (params, next) => {
      try {
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

          this.logger.debug(`🔒 Applied user isolation for ${params.model}.${params.action}`, {
            userId: context.userId,
            model: params.model,
            action: params.action,
          });
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

          this.logger.debug(`🔒 Applied user isolation for ${params.model}.create`, {
            userId: context.userId,
            model: params.model,
          });
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

          this.logger.debug(`🔒 Applied ownership verification for ${params.model}.${params.action}`, {
            userId: context.userId,
            model: params.model,
            action: params.action,
          });
        }

        return next(params);
      } catch (error) {
        this.logger.error('❌ Error in user isolation middleware', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          model: params.model,
          action: params.action,
        });
        // Re-throw to prevent unauthorized access on middleware failure
        throw error;
      }
    });
  }

  // Helper method for cleaning up test data
  async cleanDatabase() {
    try {
      if (process.env.NODE_ENV === 'production') {
        this.logger.error('🚨 CRITICAL: Attempted to clean database in production environment');
        throw new Error('Cannot clean database in production!');
      }

      this.logger.warn('⚠️ Cleaning database (test environment only)...');

      const models = Reflect.ownKeys(this).filter(
        (key) => typeof key === 'string' && key[0] !== '_' && key[0] !== '$',
      );

      this.logger.log(`🗑️ Cleaning ${models.length} models...`);

      await Promise.all(
        models.map(async (modelKey) => {
          try {
            const model = (this as any)[modelKey as string];
            if (model && typeof model.deleteMany === 'function') {
              await model.deleteMany();
              this.logger.debug(`✅ Cleaned model: ${String(modelKey)}`);
            }
          } catch (error) {
            this.logger.error(`❌ Failed to clean model: ${String(modelKey)}`, {
              error: error instanceof Error ? error.message : String(error),
            });
            // Continue cleaning other models even if one fails
          }
        }),
      );

      this.logger.log('✅ Database cleaned successfully');
    } catch (error) {
      this.logger.error('❌ Failed to clean database', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }
}
