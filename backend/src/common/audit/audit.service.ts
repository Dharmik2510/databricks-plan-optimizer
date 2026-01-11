import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AppLoggerService } from '../logging/app-logger.service';
import { deriveOrgId, deriveUserUuid } from '../tenancy/tenancy.utils';

@Injectable()
export class AuditService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly logger: AppLoggerService,
  ) {}

  async recordEvent(params: {
    orgId?: string;
    userId: string;
    action: string;
    target: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const orgId = deriveOrgId(params.userId, params.orgId);
    const userUuid = deriveUserUuid(params.userId);

    const { error } = await supabase.from('audit_events').insert({
      org_id: orgId,
      user_id: userUuid,
      action: params.action,
      target: params.target,
      metadata: params.metadata || null,
    });

    if (error) {
      this.logger.warn('Failed to record audit event', {
        action: params.action,
        target: params.target,
        error: {
          name: 'SupabaseError',
          message: error.message,
          code: error.code,
        },
      });
    }
  }
}
