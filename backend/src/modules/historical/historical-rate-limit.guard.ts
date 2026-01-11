import { CanActivate, ExecutionContext, Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface CounterState {
  count: number;
  resetAt: number;
}

@Injectable()
export class HistoricalRateLimitGuard implements CanActivate {
  private readonly userCounters = new Map<string, CounterState>();
  private readonly orgCounters = new Map<string, CounterState>();

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const userId = req.user?.id || req.ip || 'anonymous';
    const orgId = req.user?.orgId || 'unknown';

    const userLimit = this.configService.get<number>('HISTORICAL_RATE_LIMIT_USER', 10);
    const orgLimit = this.configService.get<number>('HISTORICAL_RATE_LIMIT_ORG', 50);
    const windowMs = this.configService.get<number>('HISTORICAL_RATE_LIMIT_WINDOW_MS', 60000);

    this.enforceLimit(this.userCounters, userId, userLimit, windowMs, 'user');
    this.enforceLimit(this.orgCounters, orgId, orgLimit, windowMs, 'org');

    return true;
  }

  private enforceLimit(
    store: Map<string, CounterState>,
    key: string,
    limit: number,
    windowMs: number,
    label: string,
  ) {
    const now = Date.now();
    const state = store.get(key);

    if (!state || now > state.resetAt) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      return;
    }

    if (state.count >= limit) {
      throw new HttpException(
        `Historical analysis rate limit exceeded for ${label}`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    state.count += 1;
    store.set(key, state);
  }
}
