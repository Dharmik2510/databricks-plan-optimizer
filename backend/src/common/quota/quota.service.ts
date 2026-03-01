import { Injectable, ForbiddenException, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';

interface UserQuota {
  user_id: string;
  tier: 'free' | 'pro' | 'team' | 'enterprise';
  mcp_calls_this_month: number;
  mcp_calls_limit: number;
  concurrent_analyses_limit: number;
  datasources_max: number;
  retention_days: number;
  mcp_calls_reset_at: string;
}

@Injectable()
export class QuotaService {
  private readonly logger = new Logger(QuotaService.name);
  private readonly supabase: SupabaseClient;

  constructor(
    private readonly supabaseService: SupabaseService,
  ) {
    this.supabase = this.supabaseService.getClient();
    this.logger.log('✅ Quota Service initialized');
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }

  private buildDefaultQuota(userId: string): UserQuota {
    return {
      user_id: userId,
      tier: 'free',
      mcp_calls_this_month: 0,
      mcp_calls_limit: 50,
      concurrent_analyses_limit: 1,
      datasources_max: 1,
      retention_days: 7,
      mcp_calls_reset_at: this.getNextResetDate(),
    };
  }

  async assertQuotaAvailable(userId: string): Promise<void> {
    try {
      this.logger.log(`🔍 Asserting quota availability for user: ${userId}`);

      const quota = await this.getUserQuota(userId);

      // Check if monthly reset needed
      const resetDate = new Date(quota.mcp_calls_reset_at);
      const now = new Date();

      if (resetDate < now) {
        this.logger.log(`🔄 Quota reset needed for user ${userId} (reset date: ${resetDate.toISOString()})`);
        await this.resetUserQuota(userId);
        this.logger.log(`✅ Quota reset completed - user ${userId} now has ${quota.mcp_calls_limit} calls available`);
        return; // After reset, quota is available
      }

      const remaining = quota.mcp_calls_limit - quota.mcp_calls_this_month;

      if (quota.mcp_calls_this_month >= quota.mcp_calls_limit) {
        this.logger.warn(
          `❌ Quota exceeded for user ${userId} - Tier: ${quota.tier}, Used: ${quota.mcp_calls_this_month}/${quota.mcp_calls_limit}, ` +
          `Free tier limit: 50 analyses/month - Upgrade opportunity to Pro (500 analyses/month)`
        );

        throw new ForbiddenException(
          `Monthly quota exceeded (${quota.mcp_calls_limit} analyses). ` +
          `Upgrade to Pro for 500 analyses/month at $29/mo.`,
        );
      }

      this.logger.log(
        `✅ Quota available for user ${userId} - Tier: ${quota.tier}, Used: ${quota.mcp_calls_this_month}/${quota.mcp_calls_limit}, ` +
        `Remaining: ${remaining}`
      );
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error; // Re-throw quota exceeded errors
      }

      this.logger.error(
        `❌ Failed to assert quota availability for user ${userId}`,
        error.stack
      );
      throw new Error(`Failed to check quota availability: ${error.message}`);
    }
  }

  async incrementUsage(userId: string, mcpCalls: number = 1): Promise<void> {
    try {
      if (!this.isUuid(userId)) {
        this.logger.debug(
          `Skipping persisted quota increment for non-UUID user id: ${userId}`,
        );
        return;
      }

      this.logger.log(`📊 Incrementing usage for user ${userId} by ${mcpCalls} call(s) - attempting RPC method`);

      const { error } = await this.supabase.rpc('increment_mcp_usage', {
        p_user_id: userId,
        p_increment: mcpCalls,
      });

      if (error) {
        this.logger.warn(
          `⚠️ RPC increment failed for user ${userId}: ${error.message} - falling back to manual update`
        );

        // Fallback: fetch current value and update
        const { data: quota, error: fetchError } = await this.supabase
          .from('user_quotas')
          .select('mcp_calls_this_month')
          .eq('user_id', userId)
          .single();

        if (fetchError) {
          this.logger.error(
            `❌ Fallback fetch failed for user ${userId}: ${fetchError.message}`,
            fetchError
          );
          throw new Error(`Failed to fetch current quota: ${fetchError.message}`);
        }

        const currentCount = quota?.mcp_calls_this_month || 0;
        const newCount = currentCount + mcpCalls;

        this.logger.log(
          `🔄 Fallback update: user ${userId} quota ${currentCount} → ${newCount}`
        );

        const { error: updateError } = await this.supabase
          .from('user_quotas')
          .update({
            mcp_calls_this_month: newCount,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);

        if (updateError) {
          this.logger.error(
            `❌ Fallback update failed for user ${userId}: ${updateError.message}`,
            updateError
          );
          throw new Error(`Failed to increment quota: ${updateError.message}`);
        }

        this.logger.log(
          `✅ Usage incremented via fallback for user ${userId}: ${currentCount} → ${newCount}`
        );
      } else {
        this.logger.log(
          `✅ Usage incremented via RPC for user ${userId} by ${mcpCalls} call(s)`
        );
      }
    } catch (error) {
      this.logger.error(
        `❌ Failed to increment usage for user ${userId} by ${mcpCalls} call(s)`,
        error.stack
      );
      throw error;
    }
  }

  async getUserQuota(userId: string): Promise<UserQuota> {
    try {
      if (!this.isUuid(userId)) {
        this.logger.warn(
          `Non-UUID user id detected (${userId}); using in-memory default quota profile`,
        );
        return this.buildDefaultQuota(userId);
      }

      this.logger.log(`🔍 Fetching quota for user: ${userId}`);

      const { data, error } = await this.supabase
        .from('user_quotas')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        this.logger.warn(
          `⚠️ Quota fetch error for user ${userId}: ${error.message} - creating default quota`
        );
        return this.createDefaultQuota(userId);
      }

      if (!data) {
        this.logger.log(`📝 No quota found for user ${userId} - creating default quota`);
        return this.createDefaultQuota(userId);
      }

      this.logger.log(
        `✅ Quota fetched for user ${userId} - Tier: ${data.tier}, Used: ${data.mcp_calls_this_month}/${data.mcp_calls_limit}, ` +
        `Datasources: ${data.datasources_max}, Reset: ${data.mcp_calls_reset_at}`
      );

      return data;
    } catch (error) {
      this.logger.error(
        `❌ Failed to get quota for user ${userId}`,
        error.stack
      );
      throw new Error(`Failed to fetch user quota: ${error.message}`);
    }
  }

  async checkDatasourcesLimit(userId: string): Promise<void> {
    try {
      if (!this.isUuid(userId)) {
        this.logger.warn(
          `Skipping datasource limit persistence check for non-UUID user id: ${userId}`,
        );
        return;
      }

      this.logger.log(`🔍 Checking datasources limit for user: ${userId}`);

      const quota = await this.getUserQuota(userId);

      const { count, error } = await this.supabase
        .from('data_sources')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_active', true);

      if (error) {
        this.logger.error(
          `❌ Supabase error checking datasources for user ${userId}: ${error.message}`,
          error
        );
        throw new Error(`Failed to check datasources: ${error.message}`);
      }

      const currentCount = count ?? 0;

      if (currentCount >= quota.datasources_max) {
        this.logger.warn(
          `❌ Datasources limit exceeded for user ${userId} - Tier: ${quota.tier}, Current: ${currentCount}, Max: ${quota.datasources_max}, ` +
          `Free tier limit: 1 datasource - Upgrade opportunity to Pro (3 datasources)`
        );

        throw new ForbiddenException(
          `Maximum data sources limit reached (${quota.datasources_max}). ` +
          `Upgrade to Pro for 3 data sources.`,
        );
      }

      this.logger.log(
        `✅ Datasources limit check passed for user ${userId} - Current: ${currentCount}/${quota.datasources_max} (Tier: ${quota.tier})`
      );
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error; // Re-throw limit exceeded errors
      }

      this.logger.error(
        `❌ Failed to check datasources limit for user ${userId}`,
        error.stack
      );
      throw error;
    }
  }

  private async createDefaultQuota(userId: string): Promise<UserQuota> {
    try {
      if (!this.isUuid(userId)) {
        this.logger.warn(
          `Skipping quota row creation for non-UUID user id: ${userId}`,
        );
        return this.buildDefaultQuota(userId);
      }

      this.logger.log(`📝 Creating default quota for user: ${userId} (Free tier: 50 calls/month, 1 datasource, 7 day retention)`);

      const defaultQuota = this.buildDefaultQuota(userId);

      const { data, error } = await this.supabase
        .from('user_quotas')
        .insert(defaultQuota)
        .select()
        .single();

      if (error) {
        this.logger.error(
          `❌ Supabase error creating default quota for user ${userId}: ${error.message}`,
          error
        );
        throw new Error(`Failed to create default quota: ${error.message}`);
      }

      this.logger.log(
        `✅ Default quota created for user ${userId} - Tier: free, Limit: 50 calls/month, Reset: ${defaultQuota.mcp_calls_reset_at}`
      );

      return data;
    } catch (error) {
      this.logger.error(
        `❌ Failed to create default quota for user ${userId}`,
        error.stack
      );
      throw error;
    }
  }

  private async resetUserQuota(userId: string): Promise<void> {
    try {
      if (!this.isUuid(userId)) {
        this.logger.debug(
          `Skipping persisted quota reset for non-UUID user id: ${userId}`,
        );
        return;
      }

      const nextReset = this.getNextResetDate();

      this.logger.log(
        `🔄 Resetting monthly quota for user ${userId} - Next reset: ${nextReset}`
      );

      const { error } = await this.supabase
        .from('user_quotas')
        .update({
          mcp_calls_this_month: 0,
          mcp_calls_reset_at: nextReset,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (error) {
        this.logger.error(
          `❌ Supabase error resetting quota for user ${userId}: ${error.message}`,
          error
        );
        throw new Error(`Failed to reset quota: ${error.message}`);
      }

      this.logger.log(
        `✅ Monthly quota reset completed for user ${userId} - Calls reset to 0, Next reset: ${nextReset}`
      );
    } catch (error) {
      this.logger.error(
        `❌ Failed to reset quota for user ${userId}`,
        error.stack
      );
      throw error;
    }
  }

  private getNextResetDate(): string {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return nextMonth.toISOString();
  }
}
