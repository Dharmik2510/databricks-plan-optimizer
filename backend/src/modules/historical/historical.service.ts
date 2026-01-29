import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { AppLoggerService } from '../../common/logging/app-logger.service';
import { AuditService } from '../../common/audit/audit.service';
import { deriveUserUuid } from '../../common/tenancy/tenancy.utils';
import { EncryptionService } from '../../common/security/encryption.service';
import { GeminiService } from '../../integrations/gemini/gemini.service';
import { McpClientService } from '../../integrations/mcp/mcp-client.service';
import { McpConnectionConfig } from '../../integrations/mcp/mcp.types';
import { OrgConnectionsService } from '../org-connections/org-connections.service';
import { DataSourcesService } from '../datasources/datasources.service';
import { McpProxyService } from '../../integrations/mcp-proxy/mcp-proxy.service';
import { QuotaService } from '../../common/quota/quota.service';
import {
  getFailedTaskSummary,
  getGcAnomaly,
  getShuffleHeavyStages,
  getSkewSuspicions,
  getSpillAnomalies,
  getTopSlowStages,
  getStageDurationMs,
  getStageId,
} from './historical.heuristics';
import { analysisLatencyMs } from './historical.metrics';
import { AnalyzeHistoricalDto, CompareHistoricalDto, HistoricalRunSummary, HistoryQueryDto, RunsQueryDto, UpdateHistoricalDto } from './dto';

interface AnalysisSummaryMetrics {
  durationMs: number;
  shuffleReadBytes: number;
  shuffleWriteBytes: number;
  spillBytes: number;
  gcTimeMs: number;
  executorCount: number;
  activeExecutors: number;
}

@Injectable()
export class HistoricalService {
  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
    private readonly logger: AppLoggerService,
    private readonly audit: AuditService,
    private readonly encryption: EncryptionService,
    private readonly mcpClient: McpClientService,
    private readonly orgConnectionsService: OrgConnectionsService,
    private readonly geminiService: GeminiService,
    private readonly dataSourcesService: DataSourcesService,
    private readonly mcpProxyService: McpProxyService,
    private readonly quotaService: QuotaService,
  ) {}

  async analyze(userId: string, orgId: string | undefined, dto: AnalyzeHistoricalDto, userRole?: string, datasourceId?: string) {
    const startTime = Date.now();
    const mode = 'single';

    this.logger.info(`✅ Starting historical analysis`, {
      userId,
      orgId,
      mode,
      appId: dto.appId,
      appName: dto.appName,
      datasourceId,
      hasQuestion: !!dto.question,
    });

    try {
      // Check quota before analysis
      this.logger.info('Checking quota availability before analysis', { userId, mode });
      await this.quotaService.assertQuotaAvailable(userId);
      this.logger.info('✅ Quota check passed', { userId, mode });

      const resolveStartTime = Date.now();
      const resolvedApp = await this.resolveAppId(userId, orgId, dto, userRole, datasourceId);
      const appId = resolvedApp.appId;
      this.logger.info(`✅ Resolved appId in ${Date.now() - resolveStartTime}ms`, {
        appId,
        appName: resolvedApp.appName,
        selectedBy: resolvedApp.selectedBy,
      });

      const recordStartTime = Date.now();
      const record = await this.createAnalysisRecord(userId, orgId, {
        mode,
        appIdA: appId,
        appName: resolvedApp.appName || dto.appName || null,
        userQuestion: dto.question || null,
      });
      this.logger.info(`✅ Created analysis record in ${Date.now() - recordStartTime}ms`, {
        recordId: record.id,
        mode,
        appId,
        status: record.status,
      });

      try {
        // Route based on datasource type
        const fetchStartTime = Date.now();
        const data = datasourceId
          ? await this.fetchApplicationDataViaDatasource(userId, datasourceId, appId)
          : await this.fetchApplicationDataViaOrgConnection(userId, orgId, appId);
        const fetchLatency = Date.now() - fetchStartTime;
        this.logger.info(`✅ Fetched application data in ${fetchLatency}ms`, {
          appId,
          datasourceId: datasourceId || 'org_connection',
          hasApplication: !!data.application,
          jobsCount: data.jobs?.length || 0,
          stagesCount: data.stages?.length || 0,
          slowStagesCount: data.slowStages?.length || 0,
          sqlQueriesCount: data.sqlQueries?.length || 0,
          latencyMs: fetchLatency,
        });

        this.assertBatchOnly(data.environment, appId);
        this.assertCompleted(data.application, appId);

        const metricsStartTime = Date.now();
        const summary = this.buildSummaryMetrics(data);
        this.logger.info(`✅ Built summary metrics in ${Date.now() - metricsStartTime}ms`, {
          appId,
          durationMs: summary.durationMs,
          shuffleReadBytes: summary.shuffleReadBytes,
          shuffleWriteBytes: summary.shuffleWriteBytes,
          spillBytes: summary.spillBytes,
          gcTimeMs: summary.gcTimeMs,
          executorCount: summary.executorCount,
          activeExecutors: summary.activeExecutors,
        });

        const heuristicsStartTime = Date.now();
        const heuristics = this.buildHeuristics(data);
        this.logger.info(`✅ Calculated heuristics in ${Date.now() - heuristicsStartTime}ms`, {
          appId,
          topSlowStagesCount: heuristics.topSlowStages?.length || 0,
          shuffleHeavyStagesCount: heuristics.shuffleHeavyStages?.length || 0,
          spillAnomaliesCount: heuristics.spillAnomalies?.length || 0,
          hasGcAnomaly: !!heuristics.gcAnomaly,
          skewSuspicionsCount: heuristics.skewSuspicions?.length || 0,
          failedTasksCount: heuristics.failedTasks || 0,
        });

        const evidence = this.buildEvidenceSingle(data, summary, heuristics, resolvedApp.selectedBy);

        const narrativeStartTime = Date.now();
        this.logger.info('Generating AI narrative', { appId, mode, hasQuestion: !!dto.question });
        const narrative = await this.generateNarrative({
          mode,
          evidence,
          question: dto.question,
        });
        const narrativeLatency = Date.now() - narrativeStartTime;
        this.logger.info(`✅ Generated narrative in ${narrativeLatency}ms`, {
          appId,
          mode,
          highlightsCount: narrative.highlights?.length || 0,
          actionItemsCount: narrative.action_items?.length || 0,
          narrativeLength: narrative.narrative_md?.length || 0,
          latencyMs: narrativeLatency,
        });

        evidence.agent = {
          highlights: narrative.highlights,
          action_items: narrative.action_items,
        };

        const latencyMs = Date.now() - startTime;
        analysisLatencyMs.observe({ mode, status: 'complete' }, latencyMs);

        this.logger.info('Updating analysis record to complete', { recordId: record.id, mode, latencyMs });
        const updated = await this.updateAnalysisRecord(record.id, userId, {
          status: 'complete',
          evidence,
          narrative,
          latencyMs,
          appName: data.application?.name || resolvedApp.appName || null,
        });
        this.logger.info(`✅ Analysis status transition: pending → complete`, {
          recordId: record.id,
          mode,
          appId,
          latencyMs,
        });

        await this.audit.recordEvent({
          userId,
          orgId: orgId,
          action: 'historical_analysis_requested',
          target: updated.id,
          metadata: {
            mode,
            appId,
            status: updated.status,
            latencyMs,
            datasourceId: datasourceId || null,
          },
        });

        // Increment quota after successful analysis
        this.logger.info('Incrementing quota usage', { userId, mode });
        await this.quotaService.incrementUsage(userId, 1);
        this.logger.info('✅ Quota incremented', { userId, mode });

        this.logger.info(`✅ Historical analysis completed successfully in ${latencyMs}ms`, {
          recordId: updated.id,
          mode,
          appId,
          status: updated.status,
          totalLatencyMs: latencyMs,
        });

        return updated;
      } catch (error) {
        const latencyMs = Date.now() - startTime;
        analysisLatencyMs.observe({ mode, status: 'error' }, latencyMs);

        const err = error as Error;
        this.logger.error(`❌ Analysis failed after ${latencyMs}ms`, err, {
          recordId: record.id,
          mode,
          appId: dto.appId,
          latencyMs,
        });

        this.logger.info('Updating analysis record to error state', { recordId: record.id, mode });
        await this.updateAnalysisRecord(record.id, userId, {
          status: 'error',
          error: err.message || 'Analysis failed',
          latencyMs,
        });
        this.logger.info(`✅ Analysis status transition: pending → error`, {
          recordId: record.id,
          mode,
          errorMessage: err.message,
        });

        throw error;
      }
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const err = error as Error;
      this.logger.error(`❌ Historical analysis failed completely after ${latencyMs}ms`, err, {
        userId,
        orgId,
        mode,
        appId: dto.appId,
        latencyMs,
      });
      throw error;
    }
  }

  async compare(userId: string, orgId: string | undefined, dto: CompareHistoricalDto, datasourceId?: string) {
    const startTime = Date.now();
    const mode = 'compare';

    this.logger.info(`✅ Starting historical comparison`, {
      userId,
      orgId,
      mode,
      appIdA: dto.appIdA,
      appIdB: dto.appIdB,
      datasourceId,
      hasQuestion: !!dto.question,
    });

    try {
      if (dto.appIdA === dto.appIdB) {
        this.logger.warn('❌ Comparison rejected: identical appIds', {
          appIdA: dto.appIdA,
          appIdB: dto.appIdB,
        });
        throw new BadRequestException('appIdA and appIdB must be different');
      }

      // Check quota before analysis
      this.logger.info('Checking quota availability before comparison', { userId, mode });
      await this.quotaService.assertQuotaAvailable(userId);
      this.logger.info('✅ Quota check passed', { userId, mode });

      const recordStartTime = Date.now();
      const record = await this.createAnalysisRecord(userId, orgId, {
        mode,
        appIdA: dto.appIdA,
        appIdB: dto.appIdB,
        userQuestion: dto.question || null,
      });
      this.logger.info(`✅ Created comparison record in ${Date.now() - recordStartTime}ms`, {
        recordId: record.id,
        mode,
        appIdA: dto.appIdA,
        appIdB: dto.appIdB,
        status: record.status,
      });

      try {
        // Route based on datasource type
        const fetchStartTime = Date.now();
        this.logger.info('Fetching data for both applications', {
          appIdA: dto.appIdA,
          appIdB: dto.appIdB,
          datasourceId: datasourceId || 'org_connection',
        });

        const [dataA, dataB] = datasourceId
          ? await Promise.all([
              this.fetchApplicationDataViaDatasource(userId, datasourceId, dto.appIdA),
              this.fetchApplicationDataViaDatasource(userId, datasourceId, dto.appIdB),
            ])
          : await Promise.all([
              this.fetchApplicationDataViaOrgConnection(userId, orgId, dto.appIdA),
              this.fetchApplicationDataViaOrgConnection(userId, orgId, dto.appIdB),
            ]);

        const fetchLatency = Date.now() - fetchStartTime;
        this.logger.info(`✅ Fetched both applications data in ${fetchLatency}ms`, {
          appIdA: dto.appIdA,
          appIdB: dto.appIdB,
          dataA: {
            jobsCount: dataA.jobs?.length || 0,
            stagesCount: dataA.stages?.length || 0,
            slowStagesCount: dataA.slowStages?.length || 0,
            sqlQueriesCount: dataA.sqlQueries?.length || 0,
          },
          dataB: {
            jobsCount: dataB.jobs?.length || 0,
            stagesCount: dataB.stages?.length || 0,
            slowStagesCount: dataB.slowStages?.length || 0,
            sqlQueriesCount: dataB.sqlQueries?.length || 0,
          },
          latencyMs: fetchLatency,
        });

        this.assertBatchOnly(dataA.environment, dto.appIdA);
        this.assertBatchOnly(dataB.environment, dto.appIdB);
        this.assertCompleted(dataA.application, dto.appIdA);
        this.assertCompleted(dataB.application, dto.appIdB);

        const metricsStartTime = Date.now();
        const summaryA = this.buildSummaryMetrics(dataA);
        const summaryB = this.buildSummaryMetrics(dataB);
        this.logger.info(`✅ Built summary metrics for both apps in ${Date.now() - metricsStartTime}ms`, {
          appIdA: dto.appIdA,
          summaryA: {
            durationMs: summaryA.durationMs,
            shuffleReadBytes: summaryA.shuffleReadBytes,
            spillBytes: summaryA.spillBytes,
          },
          appIdB: dto.appIdB,
          summaryB: {
            durationMs: summaryB.durationMs,
            shuffleReadBytes: summaryB.shuffleReadBytes,
            spillBytes: summaryB.spillBytes,
          },
        });

        const heuristicsStartTime = Date.now();
        const heuristicsA = this.buildHeuristics(dataA);
        const heuristicsB = this.buildHeuristics(dataB);
        this.logger.info(`✅ Calculated heuristics for both apps in ${Date.now() - heuristicsStartTime}ms`, {
          appIdA: dto.appIdA,
          heuristicsA: {
            topSlowStagesCount: heuristicsA.topSlowStages?.length || 0,
            spillAnomaliesCount: heuristicsA.spillAnomalies?.length || 0,
            hasGcAnomaly: !!heuristicsA.gcAnomaly,
          },
          appIdB: dto.appIdB,
          heuristicsB: {
            topSlowStagesCount: heuristicsB.topSlowStages?.length || 0,
            spillAnomaliesCount: heuristicsB.spillAnomalies?.length || 0,
            hasGcAnomaly: !!heuristicsB.gcAnomaly,
          },
        });

        const comparisonStartTime = Date.now();
        const comparison = this.buildComparison(summaryA, summaryB, dataA.application?.name, dataB.application?.name);
        this.logger.info(`✅ Built comparison deltas in ${Date.now() - comparisonStartTime}ms`, {
          deltas: {
            durationMs: comparison.deltas.durationMs,
            shuffleReadBytes: comparison.deltas.shuffleReadBytes,
            spillBytes: comparison.deltas.spillBytes,
            gcTimeMs: comparison.deltas.gcTimeMs,
          },
        });

        const evidence = this.buildEvidenceCompare({
          appA: dataA,
          appB: dataB,
          summaryA,
          summaryB,
          heuristicsA,
          heuristicsB,
          comparison,
        });

        const narrativeStartTime = Date.now();
        this.logger.info('Generating AI narrative for comparison', { mode, hasQuestion: !!dto.question });
        const narrative = await this.generateNarrative({
          mode,
          evidence,
          question: dto.question,
        });
        const narrativeLatency = Date.now() - narrativeStartTime;
        this.logger.info(`✅ Generated narrative in ${narrativeLatency}ms`, {
          mode,
          highlightsCount: narrative.highlights?.length || 0,
          actionItemsCount: narrative.action_items?.length || 0,
          narrativeLength: narrative.narrative_md?.length || 0,
          latencyMs: narrativeLatency,
        });

        evidence.agent = {
          highlights: narrative.highlights,
          action_items: narrative.action_items,
        };

        const latencyMs = Date.now() - startTime;
        analysisLatencyMs.observe({ mode, status: 'complete' }, latencyMs);

        this.logger.info('Updating comparison record to complete', { recordId: record.id, mode, latencyMs });
        const updated = await this.updateAnalysisRecord(record.id, userId, {
          status: 'complete',
          evidence,
          narrative,
          latencyMs,
          appName: dataA.application?.name || dataB.application?.name || null,
          appIdB: dto.appIdB,
        });
        this.logger.info(`✅ Analysis status transition: pending → complete`, {
          recordId: record.id,
          mode,
          appIdA: dto.appIdA,
          appIdB: dto.appIdB,
          latencyMs,
        });

        await this.audit.recordEvent({
          userId,
          orgId: orgId,
          action: 'historical_compare_requested',
          target: updated.id,
          metadata: {
            mode,
            appIdA: dto.appIdA,
            appIdB: dto.appIdB,
            status: updated.status,
            latencyMs,
            datasourceId: datasourceId || null,
          },
        });

        // Increment quota after successful analysis
        this.logger.info('Incrementing quota usage', { userId, mode });
        await this.quotaService.incrementUsage(userId, 1);
        this.logger.info('✅ Quota incremented', { userId, mode });

        this.logger.info(`✅ Historical comparison completed successfully in ${latencyMs}ms`, {
          recordId: updated.id,
          mode,
          appIdA: dto.appIdA,
          appIdB: dto.appIdB,
          status: updated.status,
          totalLatencyMs: latencyMs,
        });

        return updated;
      } catch (error) {
        const latencyMs = Date.now() - startTime;
        analysisLatencyMs.observe({ mode, status: 'error' }, latencyMs);

        const err = error as Error;
        this.logger.error(`❌ Comparison failed after ${latencyMs}ms`, err, {
          recordId: record.id,
          mode,
          appIdA: dto.appIdA,
          appIdB: dto.appIdB,
          latencyMs,
        });

        this.logger.info('Updating comparison record to error state', { recordId: record.id, mode });
        await this.updateAnalysisRecord(record.id, userId, {
          status: 'error',
          error: err.message || 'Comparison failed',
          latencyMs,
        });
        this.logger.info(`✅ Analysis status transition: pending → error`, {
          recordId: record.id,
          mode,
          errorMessage: err.message,
        });

        throw error;
      }
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const err = error as Error;
      this.logger.error(`❌ Historical comparison failed completely after ${latencyMs}ms`, err, {
        userId,
        orgId,
        mode,
        appIdA: dto.appIdA,
        appIdB: dto.appIdB,
        latencyMs,
      });
      throw error;
    }
  }

  async getHistory(userId: string, query: HistoryQueryDto) {
    const startTime = Date.now();

    try {
      this.logger.info('Fetching historical analysis history', {
        userId,
        mode: query.mode,
        appName: query.appName,
        appId: query.appId,
        search: query.search,
      });

      const supabase = this.supabaseService.getClient();
      const userUuid = deriveUserUuid(userId);

      let builder = supabase
        .from('historical_analysis')
        .select('*')
        .eq('user_id', userUuid)
        .order('created_at', { ascending: false });

      if (query.mode) {
        builder = builder.eq('mode', query.mode);
      }

      if (query.appName) {
        builder = builder.ilike('app_name', `%${query.appName}%`);
      }

      if (query.appId) {
        builder = builder.or(`app_id_a.ilike.%${query.appId}%,app_id_b.ilike.%${query.appId}%`);
      }

      if (query.search) {
        builder = builder.or(`app_name.ilike.%${query.search}%,app_id_a.ilike.%${query.search}%,app_id_b.ilike.%${query.search}%`);
      }

      const { data, error } = await builder;

      if (error) {
        this.logger.error('❌ Failed to fetch history', error, {
          userId,
        });
        throw new BadRequestException('Failed to fetch history');
      }

      const latencyMs = Date.now() - startTime;
      this.logger.info(`✅ Fetched history in ${latencyMs}ms`, {
        userId,
        resultCount: data?.length || 0,
        latencyMs,
      });

      return data || [];
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const err = error as Error;
      this.logger.error(`❌ getHistory failed after ${latencyMs}ms`, err, {
        userId,
        latencyMs,
      });
      throw error;
    }
  }

  async getById(userId: string, id: string) {
    const startTime = Date.now();

    try {
      this.logger.info('Fetching historical analysis by ID', { userId, analysisId: id });

      const supabase = this.supabaseService.getClient();
      const userUuid = deriveUserUuid(userId);
      const { data, error } = await supabase
        .from('historical_analysis')
        .select('*')
        .eq('id', id)
        .eq('user_id', userUuid)
        .single();

      if (error || !data) {
        this.logger.warn('❌ Historical analysis not found', {
          userId,
          analysisId: id,
          errorMessage: error ? error.message : 'No data returned',
        });
        throw new NotFoundException('Historical analysis not found');
      }

      const latencyMs = Date.now() - startTime;
      this.logger.info(`✅ Retrieved analysis in ${latencyMs}ms`, {
        userId,
        analysisId: id,
        mode: data.mode,
        status: data.status,
        latencyMs,
      });

      return data;
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const err = error as Error;
      this.logger.error(`❌ getById failed after ${latencyMs}ms`, err, {
        userId,
        analysisId: id,
        latencyMs,
      });
      throw error;
    }
  }

  async updateAnalysis(userId: string, id: string, dto: UpdateHistoricalDto) {
    const startTime = Date.now();

    try {
      this.logger.info('Updating historical analysis', {
        userId,
        analysisId: id,
        hasTitle: !!dto.title,
        tagsCount: dto.tags?.length || 0,
      });

      const supabase = this.supabaseService.getClient();
      const userUuid = deriveUserUuid(userId);
      const { data, error } = await supabase
        .from('historical_analysis')
        .update({
          title: dto.title,
          tags: dto.tags || null,
        })
        .eq('id', id)
        .eq('user_id', userUuid)
        .select('*')
        .single();

      if (error || !data) {
        this.logger.warn('❌ Failed to update analysis', {
          userId,
          analysisId: id,
          errorMessage: error ? error.message : 'No data returned',
        });
        throw new NotFoundException('Historical analysis not found');
      }

      const latencyMs = Date.now() - startTime;
      this.logger.info(`✅ Updated analysis in ${latencyMs}ms`, {
        userId,
        analysisId: id,
        title: dto.title,
        latencyMs,
      });

      return data;
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const err = error as Error;
      this.logger.error(`❌ updateAnalysis failed after ${latencyMs}ms`, err, {
        userId,
        analysisId: id,
        latencyMs,
      });
      throw error;
    }
  }

  async listRuns(userId: string, orgId: string | undefined, query: RunsQueryDto, userRole?: string, datasourceId?: string) {
    const startTime = Date.now();

    try {
      if (!query.appName) {
        this.logger.warn('❌ listRuns rejected: appName required', { userId, query });
        throw new BadRequestException('appName is required');
      }

      this.logger.info('Listing runs for application', {
        userId,
        orgId,
        appName: query.appName,
        start: query.start,
        end: query.end,
        limit: query.limit,
        datasourceId,
      });

      this.validateDateRange(query.start, query.end, userRole);

      const runs = datasourceId
        ? await this.fetchRunsViaDatasource(userId, datasourceId, query.appName, query.start, query.end, query.limit)
        : await this.fetchRunsViaOrgConnection(userId, orgId, query.appName, query.start, query.end, query.limit);

      const latencyMs = Date.now() - startTime;
      this.logger.info(`✅ Listed runs in ${latencyMs}ms`, {
        userId,
        appName: query.appName,
        runsCount: runs.length,
        datasourceId: datasourceId || 'org_connection',
        latencyMs,
      });

      return runs;
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const err = error as Error;
      this.logger.error(`❌ listRuns failed after ${latencyMs}ms`, err, {
        userId,
        orgId,
        appName: query.appName,
        latencyMs,
      });
      throw error;
    }
  }

  private async resolveAppId(userId: string, orgId: string | undefined, dto: AnalyzeHistoricalDto, userRole?: string, datasourceId?: string) {
    try {
      if (dto.appId) {
        this.logger.info('Resolved appId directly from request', { appId: dto.appId, selectedBy: 'appId' });
        return { appId: dto.appId, appName: dto.appName || null, selectedBy: 'appId' };
      }

      if (!dto.appName || !dto.startTime || !dto.endTime) {
        this.logger.warn('❌ Insufficient data to resolve appId', {
          hasAppId: !!dto.appId,
          hasAppName: !!dto.appName,
          hasStartTime: !!dto.startTime,
          hasEndTime: !!dto.endTime,
        });
        throw new BadRequestException('Provide appId or appName + startTime + endTime');
      }

      this.validateDateRange(dto.startTime, dto.endTime, userRole);

      this.logger.info('Resolving appId from appName and date range', {
        appName: dto.appName,
        startTime: dto.startTime,
        endTime: dto.endTime,
        datasourceId: datasourceId || 'org_connection',
      });

      const runs = datasourceId
        ? await this.fetchRunsViaDatasource(userId, datasourceId, dto.appName, dto.startTime, dto.endTime, 50)
        : await this.fetchRunsViaOrgConnection(userId, orgId, dto.appName, dto.startTime, dto.endTime, 50);

      if (runs.length === 0) {
        this.logger.warn('❌ No runs found for specified criteria', {
          appName: dto.appName,
          startTime: dto.startTime,
          endTime: dto.endTime,
        });
        throw new NotFoundException('No runs found for the specified appName and date range');
      }

      this.logger.info(`✅ Resolved appId from latest run`, {
        appId: runs[0].appId,
        appName: runs[0].appName,
        runsFound: runs.length,
        selectedBy: 'latest',
      });

      return { appId: runs[0].appId, appName: runs[0].appName, selectedBy: 'latest' };
    } catch (error) {
      const err = error as Error;
      this.logger.error('❌ Failed to resolve appId', err, {
        userId,
        orgId,
        appName: dto.appName,
      });
      throw error;
    }
  }

  private validateDateRange(start?: string, end?: string, userRole?: string) {
    if (!start || !end) return;

    const startDate = new Date(start);
    const endDate = new Date(end);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      this.logger.warn('❌ Invalid date range format', { start, end });
      throw new BadRequestException('Invalid date range');
    }

    if (endDate < startDate) {
      this.logger.warn('❌ Invalid date range: end before start', { start, end });
      throw new BadRequestException('endTime must be after startTime');
    }

    const diffMs = endDate.getTime() - startDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    const maxDays = this.getMaxRangeDays(userRole);
    if (diffDays > maxDays) {
      this.logger.warn('❌ Date range exceeds maximum', {
        start,
        end,
        diffDays,
        maxDays,
        userRole,
      });
      throw new BadRequestException(`Date range exceeds ${maxDays} days`);
    }

    this.logger.info('✅ Date range validated', { start, end, diffDays, maxDays });
  }

  private getMaxRangeDays(userRole?: string): number {
    const defaultMax = this.configService.get<number>('HISTORICAL_MAX_RANGE_DAYS', 30);
    const adminMax = this.configService.get<number>('HISTORICAL_MAX_RANGE_DAYS_ADMIN', defaultMax);
    const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';
    return isAdmin ? adminMax : defaultMax;
  }

  private async fetchRuns(
    mcpConfig: McpConnectionConfig,
    appName: string,
    start?: string,
    end?: string,
    limit = 50,
  ): Promise<HistoricalRunSummary[]> {
    const fetchStartTime = Date.now();

    try {
      this.logger.info('Fetching runs via MCP', {
        appName,
        start,
        end,
        limit,
        mcpServerUrl: mcpConfig.mcpServerUrl,
      });

      const apps = await this.mcpClient.callTool<any[]>(mcpConfig, 'list_applications', {
        status: ['completed'],
        min_date: start ? this.toShsDate(start) : undefined,
        max_date: end ? this.toShsDate(end) : undefined,
        limit,
      });

      const normalized = (apps || [])
        .filter((app) => (app?.name || '').toLowerCase().includes(appName.toLowerCase()))
        .map((app) => {
          const attempt = app?.attempts?.[0] || {};
          const startTime = attempt?.startTime || attempt?.start_time || null;
          const endTime = attempt?.endTime || attempt?.end_time || null;
          return {
            appId: app?.id,
            appName: app?.name,
            startTime,
            endTime,
            durationMs: attempt?.duration || this.durationMs(startTime, endTime),
            completed: attempt?.completed ?? true,
          } as HistoricalRunSummary;
        })
        .filter((app) => !!app.appId)
        .sort((a, b) => (b.startTime || '').localeCompare(a.startTime || ''));

      const latencyMs = Date.now() - fetchStartTime;
      this.logger.info(`✅ Fetched runs via MCP in ${latencyMs}ms`, {
        appName,
        totalApps: apps?.length || 0,
        matchedRuns: normalized.length,
        latencyMs,
      });

      return normalized;
    } catch (error) {
      const latencyMs = Date.now() - fetchStartTime;
      const err = error as Error;
      this.logger.error(`❌ Failed to fetch runs via MCP after ${latencyMs}ms`, err, {
        appName,
        mcpServerUrl: mcpConfig.mcpServerUrl,
        latencyMs,
      });
      throw error;
    }
  }

  private async getMcpConnection(userId: string, orgId?: string) {
    try {
      this.logger.info('Fetching MCP connection', { userId, orgId });

      const connection = await this.orgConnectionsService.getActiveConnection(userId, orgId);
      const token = connection.auth_scheme === 'none'
        ? ''
        : await this.encryption.decryptToken(connection.token_encrypted, connection.token_kid);

      const mcpConfig: McpConnectionConfig = {
        id: connection.id,
        mcpServerUrl: connection.mcp_server_url,
        authScheme: connection.auth_scheme,
        authToken: token,
        authHeaderName: connection.auth_header_name,
      };

      this.logger.info('✅ MCP connection retrieved', {
        connectionId: connection.id,
        mcpServerUrl: connection.mcp_server_url,
        authScheme: connection.auth_scheme,
      });

      return { connection, mcpConfig };
    } catch (error) {
      const err = error as Error;
      this.logger.error('❌ Failed to get MCP connection', err, {
        userId,
        orgId,
      });
      throw error;
    }
  }

  private async fetchApplicationData(mcpConfig: McpConnectionConfig, appId: string): Promise<{
    application: any;
    jobs: any[];
    stages: any[];
    executorSummary: any;
    environment: any;
    slowStages: any[];
    sqlQueries: any[];
  }> {
    const fetchStartTime = Date.now();

    try {
      this.logger.info('Fetching application data via MCP', {
        appId,
        mcpServerUrl: mcpConfig.mcpServerUrl,
      });

      const [application, jobs, stages, executorSummary, environment, slowStages, sqlQueries] = await Promise.all([
        this.mcpClient.callTool<any>(mcpConfig, 'get_application', { app_id: appId }),
        this.mcpClient.callTool<any[]>(mcpConfig, 'list_jobs', { app_id: appId }),
        this.mcpClient.callTool<any[]>(mcpConfig, 'list_stages', { app_id: appId, with_summaries: true }),
        this.mcpClient.callTool<any>(mcpConfig, 'get_executor_summary', { app_id: appId }),
        this.mcpClient.callTool<any>(mcpConfig, 'get_environment', { app_id: appId }),
        this.mcpClient.callTool<any[]>(mcpConfig, 'list_slowest_stages', { app_id: appId, n: 5 }),
        this.safeSqlQueryFetch(mcpConfig, appId),
      ]);

      const jobsList = this.normalizeArray(jobs, 'jobs');
      const stagesList = this.normalizeArray(stages, 'stages');
      const slowStagesList = this.normalizeArray(slowStages, 'stages');
      const sqlQueriesList = this.normalizeArray(sqlQueries, 'queries');

      const latencyMs = Date.now() - fetchStartTime;
      this.logger.info(`✅ Fetched application data via MCP in ${latencyMs}ms`, {
        appId,
        jobsCount: jobsList.length,
        stagesCount: stagesList.length,
        slowStagesCount: slowStagesList.length,
        sqlQueriesCount: sqlQueriesList.length,
        hasApplication: !!application,
        hasExecutorSummary: !!executorSummary,
        latencyMs,
      });

      return {
        application,
        jobs: jobsList,
        stages: stagesList,
        executorSummary: executorSummary || {},
        environment: environment || {},
        slowStages: slowStagesList,
        sqlQueries: sqlQueriesList,
      };
    } catch (error) {
      const latencyMs = Date.now() - fetchStartTime;
      const err = error as Error;
      this.logger.error(`❌ Failed to fetch application data via MCP after ${latencyMs}ms`, err, {
        appId,
        mcpServerUrl: mcpConfig.mcpServerUrl,
        latencyMs,
      });
      throw error;
    }
  }

  private async safeSqlQueryFetch(mcpConfig: McpConnectionConfig, appId: string): Promise<any[]> {
    try {
      this.logger.info('Fetching SQL query metrics', { appId });
      const result = await this.mcpClient.callTool<any[]>(mcpConfig, 'list_slowest_sql_queries', {
        app_id: appId,
        top_n: 5,
        include_running: false,
      });
      this.logger.info('✅ SQL query metrics fetched', { appId, queriesCount: result?.length || 0 });
      return result;
    } catch (error) {
      const err = error as Error;
      this.logger.warn('SQL query metrics unavailable', {
        appId,
        error: {
          name: err.name || 'Error',
          message: err.message,
        },
      });
      return [];
    }
  }

  // New routing methods for datasource support
  private async fetchApplicationDataViaDatasource(userId: string, datasourceId: string, appId: string) {
    const startTime = Date.now();

    try {
      this.logger.info('Fetching application data via datasource', {
        userId,
        datasourceId,
        appId,
      });

      const datasource = await this.dataSourcesService.getWithDecryptedTokens(userId, datasourceId);

      this.logger.info('Datasource retrieved', {
        datasourceId,
        connectionType: datasource.connection_type,
        appId,
      });

      let result;
      if (datasource.connection_type === 'gateway_shs') {
        result = await this.fetchApplicationDataViaGateway(userId, datasource, appId);
      } else if (datasource.connection_type === 'external_mcp') {
        result = await this.fetchApplicationDataViaExternalMcp(datasource, appId);
      } else {
        this.logger.error('❌ Invalid connection type', new Error('Invalid connection type'), {
          datasourceId,
          connectionType: datasource.connection_type,
        });
        throw new BadRequestException('Invalid connection type');
      }

      const latencyMs = Date.now() - startTime;
      this.logger.info(`✅ Fetched application data via datasource in ${latencyMs}ms`, {
        datasourceId,
        connectionType: datasource.connection_type,
        appId,
        latencyMs,
      });

      return result;
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const err = error as Error;
      this.logger.error(`❌ Failed to fetch application data via datasource after ${latencyMs}ms`, err, {
        userId,
        datasourceId,
        appId,
        latencyMs,
      });
      throw error;
    }
  }

  private async fetchApplicationDataViaOrgConnection(userId: string, orgId: string | undefined, appId: string) {
    const startTime = Date.now();

    try {
      this.logger.info('Fetching application data via org connection', {
        userId,
        orgId,
        appId,
      });

      const { mcpConfig } = await this.getMcpConnection(userId, orgId);
      const result = await this.fetchApplicationData(mcpConfig, appId);

      const latencyMs = Date.now() - startTime;
      this.logger.info(`✅ Fetched application data via org connection in ${latencyMs}ms`, {
        orgId,
        appId,
        latencyMs,
      });

      return result;
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const err = error as Error;
      this.logger.error(`❌ Failed to fetch application data via org connection after ${latencyMs}ms`, err, {
        userId,
        orgId,
        appId,
        latencyMs,
      });
      throw error;
    }
  }

  private async fetchApplicationDataViaGateway(userId: string, datasource: any, appId: string) {
    const fetchStartTime = Date.now();

    try {
      this.logger.info('Fetching application data via gateway/SHS', {
        datasourceId: datasource.id,
        appId,
        shsBaseUrl: datasource.shs_base_url,
        hasTunnel: !!datasource.tunnel_config,
      });

      const shsConfig = {
        baseUrl: datasource.shs_base_url,
        authScheme: datasource.shs_auth_scheme,
        authToken: datasource.decrypted_shs_token,
        authHeaderName: datasource.shs_auth_header_name,
      };

      const tunnelConfig = datasource.tunnel_config
        ? {
            sshHost: datasource.tunnel_config.ssh_host,
            sshPort: datasource.tunnel_config.ssh_port,
            sshUser: datasource.tunnel_config.ssh_user,
            sshPrivateKey: datasource.tunnel_config.ssh_private_key,
            remoteHost: datasource.tunnel_config.remote_host,
            remotePort: datasource.tunnel_config.remote_port,
            localPort: 19000 + Math.floor(Math.random() * 1000),
          }
        : null;

      const [application, jobs, stages, executorSummary, environment, slowStages, sqlQueries] = await Promise.all([
        this.mcpProxyService.callTool(shsConfig, tunnelConfig, 'get_application', { app_id: appId }, userId, datasource.id),
        this.mcpProxyService.callTool(shsConfig, tunnelConfig, 'list_jobs', { app_id: appId }, userId, datasource.id),
        this.mcpProxyService.callTool(shsConfig, tunnelConfig, 'list_stages', { app_id: appId, with_summaries: true }, userId, datasource.id),
        this.mcpProxyService.callTool(shsConfig, tunnelConfig, 'get_executor_summary', { app_id: appId }, userId, datasource.id),
        this.mcpProxyService.callTool(shsConfig, tunnelConfig, 'get_environment', { app_id: appId }, userId, datasource.id),
        this.mcpProxyService.callTool(shsConfig, tunnelConfig, 'list_slowest_stages', { app_id: appId, n: 5 }, userId, datasource.id),
        this.safeSqlQueryFetchViaGateway(shsConfig, tunnelConfig, appId, userId, datasource.id),
      ]);

      const jobsList = this.normalizeArray(jobs, 'jobs');
      const stagesList = this.normalizeArray(stages, 'stages');
      const slowStagesList = this.normalizeArray(slowStages, 'stages');
      const sqlQueriesList = this.normalizeArray(sqlQueries, 'queries');

      const latencyMs = Date.now() - fetchStartTime;
      this.logger.info(`✅ Fetched application data via gateway in ${latencyMs}ms`, {
        datasourceId: datasource.id,
        appId,
        jobsCount: jobsList.length,
        stagesCount: stagesList.length,
        slowStagesCount: slowStagesList.length,
        sqlQueriesCount: sqlQueriesList.length,
        latencyMs,
      });

      return {
        application,
        jobs: jobsList,
        stages: stagesList,
        executorSummary: executorSummary || {},
        environment: environment || {},
        slowStages: slowStagesList,
        sqlQueries: sqlQueriesList,
      };
    } catch (error) {
      const latencyMs = Date.now() - fetchStartTime;
      const err = error as Error;
      this.logger.error(`❌ Failed to fetch application data via gateway after ${latencyMs}ms`, err, {
        datasourceId: datasource.id,
        appId,
        latencyMs,
      });
      throw error;
    }
  }

  private async fetchApplicationDataViaExternalMcp(datasource: any, appId: string) {
    const startTime = Date.now();

    try {
      this.logger.info('Fetching application data via external MCP', {
        datasourceId: datasource.id,
        appId,
        externalMcpUrl: datasource.external_mcp_url,
      });

      const mcpConfig: McpConnectionConfig = {
        id: datasource.id,
        mcpServerUrl: datasource.external_mcp_url,
        authScheme: datasource.decrypted_external_mcp_token ? 'bearer' : 'none',
        authToken: datasource.decrypted_external_mcp_token || '',
      };

      const result = await this.fetchApplicationData(mcpConfig, appId);

      const latencyMs = Date.now() - startTime;
      this.logger.info(`✅ Fetched application data via external MCP in ${latencyMs}ms`, {
        datasourceId: datasource.id,
        appId,
        latencyMs,
      });

      return result;
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const err = error as Error;
      this.logger.error(`❌ Failed to fetch application data via external MCP after ${latencyMs}ms`, err, {
        datasourceId: datasource.id,
        appId,
        latencyMs,
      });
      throw error;
    }
  }

  private async safeSqlQueryFetchViaGateway(shsConfig: any, tunnelConfig: any, appId: string, userId: string, datasourceId: string): Promise<any[]> {
    try {
      this.logger.info('Fetching SQL query metrics via gateway', { appId, datasourceId });
      const result = await this.mcpProxyService.callTool(
        shsConfig,
        tunnelConfig,
        'list_slowest_sql_queries',
        { app_id: appId, top_n: 5, include_running: false },
        userId,
        datasourceId,
      ) as any[];
      this.logger.info('✅ SQL query metrics fetched via gateway', {
        appId,
        datasourceId,
        queriesCount: result?.length || 0,
      });
      return result;
    } catch (error) {
      const err = error as Error;
      this.logger.warn('SQL query metrics unavailable via gateway', {
        appId,
        datasourceId,
        error: {
          name: err.name || 'Error',
          message: err.message,
        },
      });
      return [];
    }
  }

  private async fetchRunsViaDatasource(userId: string, datasourceId: string, appName: string, start?: string, end?: string, limit = 50): Promise<HistoricalRunSummary[]> {
    const startTime = Date.now();

    try {
      this.logger.info('Fetching runs via datasource', {
        userId,
        datasourceId,
        appName,
        start,
        end,
        limit,
      });

      const datasource = await this.dataSourcesService.getWithDecryptedTokens(userId, datasourceId);

      let runs: HistoricalRunSummary[];
      if (datasource.connection_type === 'gateway_shs') {
        runs = await this.fetchRunsViaGateway(userId, datasource, appName, start, end, limit);
      } else if (datasource.connection_type === 'external_mcp') {
        runs = await this.fetchRunsViaExternalMcp(datasource, appName, start, end, limit);
      } else {
        this.logger.error('❌ Invalid connection type', new Error('Invalid connection type'), {
          datasourceId,
          connectionType: datasource.connection_type,
        });
        throw new BadRequestException('Invalid connection type');
      }

      const latencyMs = Date.now() - startTime;
      this.logger.info(`✅ Fetched runs via datasource in ${latencyMs}ms`, {
        datasourceId,
        connectionType: datasource.connection_type,
        appName,
        runsCount: runs.length,
        latencyMs,
      });

      return runs;
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const err = error as Error;
      this.logger.error(`❌ Failed to fetch runs via datasource after ${latencyMs}ms`, err, {
        userId,
        datasourceId,
        appName,
        latencyMs,
      });
      throw error;
    }
  }

  private async fetchRunsViaOrgConnection(userId: string, orgId: string | undefined, appName: string, start?: string, end?: string, limit = 50): Promise<HistoricalRunSummary[]> {
    const startTime = Date.now();

    try {
      this.logger.info('Fetching runs via org connection', {
        userId,
        orgId,
        appName,
        start,
        end,
        limit,
      });

      const { mcpConfig } = await this.getMcpConnection(userId, orgId);
      const runs = await this.fetchRuns(mcpConfig, appName, start, end, limit);

      const latencyMs = Date.now() - startTime;
      this.logger.info(`✅ Fetched runs via org connection in ${latencyMs}ms`, {
        orgId,
        appName,
        runsCount: runs.length,
        latencyMs,
      });

      return runs;
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const err = error as Error;
      this.logger.error(`❌ Failed to fetch runs via org connection after ${latencyMs}ms`, err, {
        userId,
        orgId,
        appName,
        latencyMs,
      });
      throw error;
    }
  }

  private async fetchRunsViaGateway(userId: string, datasource: any, appName: string, start?: string, end?: string, limit = 50): Promise<HistoricalRunSummary[]> {
    const fetchStartTime = Date.now();

    try {
      this.logger.info('Fetching runs via gateway/SHS', {
        datasourceId: datasource.id,
        appName,
        start,
        end,
        limit,
      });

      const shsConfig = {
        baseUrl: datasource.shs_base_url,
        authScheme: datasource.shs_auth_scheme,
        authToken: datasource.decrypted_shs_token,
        authHeaderName: datasource.shs_auth_header_name,
      };

      const tunnelConfig = datasource.tunnel_config
        ? {
            sshHost: datasource.tunnel_config.ssh_host,
            sshPort: datasource.tunnel_config.ssh_port,
            sshUser: datasource.tunnel_config.ssh_user,
            sshPrivateKey: datasource.tunnel_config.ssh_private_key,
            remoteHost: datasource.tunnel_config.remote_host,
            remotePort: datasource.tunnel_config.remote_port,
            localPort: 19000 + Math.floor(Math.random() * 1000),
          }
        : null;

      const apps = await this.mcpProxyService.callTool<any[]>(
        shsConfig,
        tunnelConfig,
        'list_applications',
        {
          status: ['completed'],
          min_date: start ? this.toShsDate(start) : undefined,
          max_date: end ? this.toShsDate(end) : undefined,
          limit,
        },
        userId,
        datasource.id,
      );

      const runs = this.normalizeRuns(apps, appName);

      const latencyMs = Date.now() - fetchStartTime;
      this.logger.info(`✅ Fetched runs via gateway in ${latencyMs}ms`, {
        datasourceId: datasource.id,
        appName,
        totalApps: apps?.length || 0,
        matchedRuns: runs.length,
        latencyMs,
      });

      return runs;
    } catch (error) {
      const latencyMs = Date.now() - fetchStartTime;
      const err = error as Error;
      this.logger.error(`❌ Failed to fetch runs via gateway after ${latencyMs}ms`, err, {
        datasourceId: datasource.id,
        appName,
        latencyMs,
      });
      throw error;
    }
  }

  private async fetchRunsViaExternalMcp(datasource: any, appName: string, start?: string, end?: string, limit = 50): Promise<HistoricalRunSummary[]> {
    const startTime = Date.now();

    try {
      this.logger.info('Fetching runs via external MCP', {
        datasourceId: datasource.id,
        appName,
        start,
        end,
        limit,
      });

      const mcpConfig: McpConnectionConfig = {
        id: datasource.id,
        mcpServerUrl: datasource.external_mcp_url,
        authScheme: datasource.decrypted_external_mcp_token ? 'bearer' : 'none',
        authToken: datasource.decrypted_external_mcp_token || '',
      };

      const runs = await this.fetchRuns(mcpConfig, appName, start, end, limit);

      const latencyMs = Date.now() - startTime;
      this.logger.info(`✅ Fetched runs via external MCP in ${latencyMs}ms`, {
        datasourceId: datasource.id,
        appName,
        runsCount: runs.length,
        latencyMs,
      });

      return runs;
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const err = error as Error;
      this.logger.error(`❌ Failed to fetch runs via external MCP after ${latencyMs}ms`, err, {
        datasourceId: datasource.id,
        appName,
        latencyMs,
      });
      throw error;
    }
  }

  private normalizeRuns(apps: any[], appName: string): HistoricalRunSummary[] {
    const normalized = (apps || [])
      .filter((app) => (app?.name || '').toLowerCase().includes(appName.toLowerCase()))
      .map((app) => {
        const attempt = app?.attempts?.[0] || {};
        const startTime = attempt?.startTime || attempt?.start_time || null;
        const endTime = attempt?.endTime || attempt?.end_time || null;
        return {
          appId: app?.id,
          appName: app?.name,
          startTime,
          endTime,
          durationMs: attempt?.duration || this.durationMs(startTime, endTime),
          completed: attempt?.completed ?? true,
        } as HistoricalRunSummary;
      })
      .filter((app) => !!app.appId)
      .sort((a, b) => (b.startTime || '').localeCompare(a.startTime || ''));

    return normalized;
  }

  private assertBatchOnly(environment: any, appId: string) {
    try {
      const props = environment?.spark_properties || environment?.sparkProperties || [];
      const entries = Array.isArray(props) ? props : Object.entries(props || {});
      const hasStreamingProps = entries.some(([key]: any) => {
        const lower = String(key).toLowerCase();
        return lower.startsWith('spark.streaming') || lower.startsWith('spark.sql.streaming');
      });

      if (hasStreamingProps) {
        this.logger.warn('❌ Streaming application detected', { appId });
        throw new BadRequestException(`Streaming applications are not supported: ${appId}`);
      }

      this.logger.info('✅ Batch application validated', { appId });
    } catch (error) {
      const err = error as Error;
      this.logger.error('❌ Failed to validate batch application', err, {
        appId,
      });
      throw error;
    }
  }

  private assertCompleted(application: any, appId: string) {
    try {
      const attempts = application?.attempts || [];
      const completed = attempts.some((attempt: any) => attempt?.completed || attempt?.endTime || attempt?.end_time);
      if (!completed) {
        this.logger.warn('❌ Application not completed', { appId, attemptsCount: attempts.length });
        throw new BadRequestException(`Application ${appId} is not completed`);
      }

      this.logger.info('✅ Application completion validated', { appId });
    } catch (error) {
      const err = error as Error;
      this.logger.error('❌ Failed to validate application completion', err, {
        appId,
      });
      throw error;
    }
  }

  private buildSummaryMetrics(data: any): AnalysisSummaryMetrics {
    try {
      const stages = this.normalizeArray(data.stages, 'stages');
      const attempt = data.application?.attempts?.[0] || {};
      const startTime = attempt?.startTime || attempt?.start_time || null;
      const endTime = attempt?.endTime || attempt?.end_time || null;
      const durationMs = attempt?.duration || this.durationMs(startTime, endTime) || 0;

      const shuffleRead = data.executorSummary?.total_shuffle_read || data.executorSummary?.totalShuffleRead || 0;
      const shuffleWrite = data.executorSummary?.total_shuffle_write || data.executorSummary?.totalShuffleWrite || 0;
      const gcTimeMs = data.executorSummary?.total_gc_time || data.executorSummary?.totalGcTime || 0;

      const spillBytes = stages.reduce((sum: number, stage: any) => {
        return sum + (stage?.memory_bytes_spilled || stage?.memoryBytesSpilled || 0) + (stage?.disk_bytes_spilled || stage?.diskBytesSpilled || 0);
      }, 0);

      return {
        durationMs,
        shuffleReadBytes: shuffleRead,
        shuffleWriteBytes: shuffleWrite,
        spillBytes,
        gcTimeMs,
        executorCount: data.executorSummary?.total_executors || data.executorSummary?.totalExecutors || 0,
        activeExecutors: data.executorSummary?.active_executors || data.executorSummary?.activeExecutors || 0,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error('❌ Failed to build summary metrics', err);
      throw error;
    }
  }

  private buildHeuristics(data: any) {
    try {
      const stages = this.normalizeArray(data.stages, 'stages');
      const slowStages = this.normalizeArray(data.slowStages, 'stages');
      return {
        topSlowStages: getTopSlowStages(stages, 3),
        shuffleHeavyStages: getShuffleHeavyStages(stages, 3),
        spillAnomalies: getSpillAnomalies(stages, 3),
        gcAnomaly: getGcAnomaly(data.executorSummary),
        skewSuspicions: getSkewSuspicions(stages, 3),
        failedTasks: getFailedTaskSummary(data.jobs || [], stages),
        slowStages: slowStages.map((stage: any) => ({
          stageId: getStageId(stage),
          name: stage?.name || 'Stage',
          durationMs: getStageDurationMs(stage),
          numTasks: stage?.num_tasks || stage?.numTasks || 0,
        })),
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error('❌ Failed to build heuristics', err);
      throw error;
    }
  }

  private buildEvidenceSingle(data: any, summary: AnalysisSummaryMetrics, heuristics: any, selectedBy?: string) {
    try {
      const attempt = data.application?.attempts?.[0] || {};
      const evidence = {
        mode: 'single',
        selection: {
          selectedBy: selectedBy || 'appId',
        },
        application: {
          id: data.application?.id,
          name: data.application?.name,
          startTime: attempt?.startTime || attempt?.start_time || null,
          endTime: attempt?.endTime || attempt?.end_time || null,
          durationMs: summary.durationMs,
          sparkVersion: attempt?.appSparkVersion || attempt?.app_spark_version || null,
        },
        summary,
        heuristics,
        sqlQueries: data.sqlQueries,
      };

      return this.sanitizeEvidence(evidence);
    } catch (error) {
      const err = error as Error;
      this.logger.error('❌ Failed to build evidence (single)', err);
      throw error;
    }
  }

  private buildEvidenceCompare(params: {
    appA: any;
    appB: any;
    summaryA: AnalysisSummaryMetrics;
    summaryB: AnalysisSummaryMetrics;
    heuristicsA: any;
    heuristicsB: any;
    comparison: any;
  }) {
    try {
      const attemptA = params.appA.application?.attempts?.[0] || {};
      const attemptB = params.appB.application?.attempts?.[0] || {};

      const evidence = {
        mode: 'compare',
        appA: {
          id: params.appA.application?.id,
          name: params.appA.application?.name,
          startTime: attemptA?.startTime || attemptA?.start_time || null,
          endTime: attemptA?.endTime || attemptA?.end_time || null,
          durationMs: params.summaryA.durationMs,
          summary: params.summaryA,
          heuristics: params.heuristicsA,
        },
        appB: {
          id: params.appB.application?.id,
          name: params.appB.application?.name,
          startTime: attemptB?.startTime || attemptB?.start_time || null,
          endTime: attemptB?.endTime || attemptB?.end_time || null,
          durationMs: params.summaryB.durationMs,
          summary: params.summaryB,
          heuristics: params.heuristicsB,
        },
        comparison: params.comparison,
      };

      return this.sanitizeEvidence(evidence);
    } catch (error) {
      const err = error as Error;
      this.logger.error('❌ Failed to build evidence (compare)', err);
      throw error;
    }
  }

  private buildComparison(summaryA: AnalysisSummaryMetrics, summaryB: AnalysisSummaryMetrics, nameA?: string, nameB?: string) {
    try {
      return {
        appA: {
          name: nameA || 'Run A',
          summary: summaryA,
        },
        appB: {
          name: nameB || 'Run B',
          summary: summaryB,
        },
        deltas: {
          durationMs: this.percentChange(summaryA.durationMs, summaryB.durationMs),
          shuffleReadBytes: this.percentChange(summaryA.shuffleReadBytes, summaryB.shuffleReadBytes),
          shuffleWriteBytes: this.percentChange(summaryA.shuffleWriteBytes, summaryB.shuffleWriteBytes),
          spillBytes: this.percentChange(summaryA.spillBytes, summaryB.spillBytes),
          gcTimeMs: this.percentChange(summaryA.gcTimeMs, summaryB.gcTimeMs),
        },
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error('❌ Failed to build comparison', err);
      throw error;
    }
  }

  private percentChange(a: number, b: number) {
    if (!a && !b) return 0;
    if (!a) return 100;
    return ((b - a) / a) * 100;
  }

  private async generateNarrative(params: { mode: 'single' | 'compare'; evidence: any; question?: string }) {
    const startTime = Date.now();

    try {
      this.logger.info('Generating narrative with AI', {
        mode: params.mode,
        hasQuestion: !!params.question,
        evidenceSize: JSON.stringify(params.evidence).length,
      });

      const prompt = `You are generating a Spark historical analysis report.\n\nRules:\n- ONLY use the numeric values present in the JSON evidence below.\n- If a metric is missing, say "not available".\n- Cite evidence numbers directly in the narrative.\n- Provide concise highlights and action items.\n\nReturn JSON with keys: narrative_md, highlights (array of strings), action_items (array of strings).\n\nEvidence JSON:\n${JSON.stringify(params.evidence)}\n\nUser question: ${params.question || 'None'}`;

      const raw = await this.geminiService.generateHistoricalNarrative(prompt);
      const cleaned = raw.trim().replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
      const parsed = JSON.parse(cleaned);

      if (!parsed.narrative_md || !Array.isArray(parsed.highlights) || !Array.isArray(parsed.action_items)) {
        this.logger.warn('Invalid narrative output structure', { parsed });
        throw new Error('Invalid narrative output');
      }

      const latencyMs = Date.now() - startTime;
      this.logger.info(`✅ Narrative generated successfully in ${latencyMs}ms`, {
        mode: params.mode,
        narrativeLength: parsed.narrative_md.length,
        highlightsCount: parsed.highlights.length,
        actionItemsCount: parsed.action_items.length,
        latencyMs,
      });

      return parsed;
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const err = error as Error;
      this.logger.warn(`❌ Narrative generation failed after ${latencyMs}ms, using fallback`, {
        mode: params.mode,
        error: {
          name: err.name || 'Error',
          message: err.message,
          stack: err.stack,
        },
        latencyMs,
      });

      const fallback = {
        narrative_md: this.fallbackNarrative(params),
        highlights: ['Narrative auto-generated fallback due to model error'],
        action_items: ['Review stages with highest duration and shuffle metrics.'],
      };

      this.logger.info('Using fallback narrative', {
        mode: params.mode,
        fallbackLength: fallback.narrative_md.length,
      });

      return fallback;
    }
  }

  private fallbackNarrative(params: { mode: 'single' | 'compare'; evidence: any }) {
    if (params.mode === 'compare') {
      return `### Comparison Overview\nRun A duration: ${params.evidence?.appA?.summary?.durationMs ?? 'not available'} ms\nRun B duration: ${params.evidence?.appB?.summary?.durationMs ?? 'not available'} ms\n\n### Highlights\n- Shuffle read delta: ${params.evidence?.comparison?.deltas?.shuffleReadBytes?.toFixed?.(2) ?? 'n/a'}%\n- Spill delta: ${params.evidence?.comparison?.deltas?.spillBytes?.toFixed?.(2) ?? 'n/a'}%`;
    }

    return `### Run Summary\nDuration: ${params.evidence?.summary?.durationMs ?? 'not available'} ms\n\n### Top Bottlenecks\n${(params.evidence?.heuristics?.topSlowStages || [])
      .map((stage: any) => `- Stage ${stage.stageId}: ${stage.durationMs} ms`)
      .join('\n') || 'No stage data available.'}`;
  }

  private sanitizeEvidence(payload: any): any {
    if (Array.isArray(payload)) {
      return payload.map((item) => this.sanitizeEvidence(item));
    }

    if (payload && typeof payload === 'object') {
      const sanitized: Record<string, any> = {};
      for (const [key, value] of Object.entries(payload)) {
        const lower = key.toLowerCase();
        if (['token', 'authorization', 'auth', 'cookie', 'set-cookie', 'headers'].some((needle) => lower.includes(needle))) {
          continue;
        }
        sanitized[key] = this.sanitizeEvidence(value);
      }
      return sanitized;
    }

    if (typeof payload === 'string') {
      if (payload.startsWith('http') && payload.includes('?')) {
        return payload.split('?')[0];
      }
      return payload;
    }

    return payload;
  }

  private async createAnalysisRecord(userId: string, orgId: string | undefined, params: {
    mode: 'single' | 'compare';
    appIdA: string;
    appIdB?: string;
    appName?: string | null;
    userQuestion?: string | null;
  }) {
    const startTime = Date.now();

    try {
      this.logger.info('Creating analysis record', {
        userId,
        orgId,
        mode: params.mode,
        appIdA: params.appIdA,
        appIdB: params.appIdB,
      });

      const supabase = this.supabaseService.getClient();
      const userUuid = deriveUserUuid(userId);

      const { data, error } = await supabase
        .from('historical_analysis')
        .insert({
          user_id: userUuid,
          mode: params.mode,
          app_id_a: params.appIdA,
          app_id_b: params.appIdB || null,
          app_name: params.appName || null,
          user_question: params.userQuestion || null,
          evidence_json: {},
          narrative_md: '',
          status: 'pending',
        })
        .select('*')
        .single();

      if (error || !data) {
        this.logger.error('❌ Failed to create analysis record', error || new Error('No data returned'), {
          userId,
          mode: params.mode,
        });
        throw new BadRequestException('Failed to create analysis record');
      }

      const latencyMs = Date.now() - startTime;
      this.logger.info(`✅ Created analysis record in ${latencyMs}ms`, {
        recordId: data.id,
        mode: params.mode,
        status: data.status,
        latencyMs,
      });

      return data;
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const err = error as Error;
      this.logger.error(`❌ createAnalysisRecord failed after ${latencyMs}ms`, err, {
        userId,
        mode: params.mode,
        latencyMs,
      });
      throw error;
    }
  }

  private async updateAnalysisRecord(id: string, userId: string, params: {
    status: 'pending' | 'complete' | 'error';
    evidence?: any;
    narrative?: { narrative_md: string; highlights: string[]; action_items: string[] };
    latencyMs?: number;
    error?: string;
    appName?: string | null;
    appIdB?: string;
  }) {
    const startTime = Date.now();

    try {
      this.logger.info('Updating analysis record', {
        recordId: id,
        userId,
        status: params.status,
        hasEvidence: !!params.evidence,
        hasNarrative: !!params.narrative,
        latencyMs: params.latencyMs,
        errorMessage: params.error,
      });

      const supabase = this.supabaseService.getClient();
      const userUuid = deriveUserUuid(userId);

      const updatePayload: Record<string, any> = {
        status: params.status,
        latency_ms: params.latencyMs || null,
        error: params.error || null,
      };

      if (params.appName !== undefined) updatePayload.app_name = params.appName;
      if (params.appIdB !== undefined) updatePayload.app_id_b = params.appIdB;

      if (params.evidence) {
        updatePayload.evidence_json = params.evidence;
      }
      if (params.narrative) {
        updatePayload.narrative_md = params.narrative.narrative_md;
        updatePayload.tags = params.narrative.highlights || null;
      }

      const { data, error } = await supabase
        .from('historical_analysis')
        .update(updatePayload)
        .eq('id', id)
        .eq('user_id', userUuid)
        .select('*')
        .single();

      if (error || !data) {
        this.logger.error('❌ Failed to update analysis record', error || new Error('No data returned'), {
          recordId: id,
          userId,
          status: params.status,
        });
        throw new BadRequestException('Failed to update analysis record');
      }

      const updateLatencyMs = Date.now() - startTime;
      this.logger.info(`✅ Updated analysis record in ${updateLatencyMs}ms`, {
        recordId: id,
        status: params.status,
        latencyMs: updateLatencyMs,
      });

      return data;
    } catch (error) {
      const updateLatencyMs = Date.now() - startTime;
      const err = error as Error;
      this.logger.error(`❌ updateAnalysisRecord failed after ${updateLatencyMs}ms`, err, {
        recordId: id,
        userId,
        status: params.status,
        latencyMs: updateLatencyMs,
      });
      throw error;
    }
  }

  private toShsDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date format');
    }
    const iso = date.toISOString();
    return iso.replace('Z', 'GMT');
  }

  private durationMs(start?: string | null, end?: string | null): number | null {
    if (!start || !end) return null;
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return null;
    }
    return endDate.getTime() - startDate.getTime();
  }

  private normalizeArray(value: any, key?: string): any[] {
    if (Array.isArray(value)) return value;
    if (key && value && Array.isArray(value[key])) return value[key];
    if (value && Array.isArray(value.items)) return value.items;
    return [];
  }
}
