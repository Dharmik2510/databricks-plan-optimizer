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
  ) {}

  async analyze(userId: string, orgId: string | undefined, dto: AnalyzeHistoricalDto, userRole?: string) {
    const startTime = Date.now();

    const resolvedApp = await this.resolveAppId(userId, orgId, dto, userRole);
    const appId = resolvedApp.appId;

    const record = await this.createAnalysisRecord(userId, orgId, {
      mode: 'single',
      appIdA: appId,
      appName: resolvedApp.appName || dto.appName || null,
      userQuestion: dto.question || null,
    });

    try {
      const { connection, mcpConfig } = await this.getMcpConnection(userId, orgId);
      const data = await this.fetchApplicationData(mcpConfig, appId);

      this.assertBatchOnly(data.environment, appId);
      this.assertCompleted(data.application, appId);

      const summary = this.buildSummaryMetrics(data);
      const heuristics = this.buildHeuristics(data);
      const evidence = this.buildEvidenceSingle(data, summary, heuristics, resolvedApp.selectedBy);

      const narrative = await this.generateNarrative({
        mode: 'single',
        evidence,
        question: dto.question,
      });
      evidence.agent = {
        highlights: narrative.highlights,
        action_items: narrative.action_items,
      };

      const latencyMs = Date.now() - startTime;
      analysisLatencyMs.observe({ mode: 'single', status: 'complete' }, latencyMs);

      const updated = await this.updateAnalysisRecord(record.id, userId, {
        status: 'complete',
        evidence,
        narrative,
        latencyMs,
        appName: data.application?.name || resolvedApp.appName || null,
      });

      await this.audit.recordEvent({
        userId,
        orgId: connection.org_id,
        action: 'historical_analysis_requested',
        target: updated.id,
        metadata: {
          mode: 'single',
          appId,
          status: updated.status,
          latencyMs,
        },
      });

      return updated;
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      analysisLatencyMs.observe({ mode: 'single', status: 'error' }, latencyMs);
      await this.updateAnalysisRecord(record.id, userId, {
        status: 'error',
        error: (error as Error).message || 'Analysis failed',
        latencyMs,
      });
      throw error;
    }
  }

  async compare(userId: string, orgId: string | undefined, dto: CompareHistoricalDto) {
    const startTime = Date.now();

    if (dto.appIdA === dto.appIdB) {
      throw new BadRequestException('appIdA and appIdB must be different');
    }

    const record = await this.createAnalysisRecord(userId, orgId, {
      mode: 'compare',
      appIdA: dto.appIdA,
      appIdB: dto.appIdB,
      userQuestion: dto.question || null,
    });

    try {
      const { connection, mcpConfig } = await this.getMcpConnection(userId, orgId);

      const [dataA, dataB] = await Promise.all([
        this.fetchApplicationData(mcpConfig, dto.appIdA),
        this.fetchApplicationData(mcpConfig, dto.appIdB),
      ]);

      this.assertBatchOnly(dataA.environment, dto.appIdA);
      this.assertBatchOnly(dataB.environment, dto.appIdB);
      this.assertCompleted(dataA.application, dto.appIdA);
      this.assertCompleted(dataB.application, dto.appIdB);

      const summaryA = this.buildSummaryMetrics(dataA);
      const summaryB = this.buildSummaryMetrics(dataB);
      const heuristicsA = this.buildHeuristics(dataA);
      const heuristicsB = this.buildHeuristics(dataB);

      const comparison = this.buildComparison(summaryA, summaryB, dataA.application?.name, dataB.application?.name);

      const evidence = this.buildEvidenceCompare({
        appA: dataA,
        appB: dataB,
        summaryA,
        summaryB,
        heuristicsA,
        heuristicsB,
        comparison,
      });

      const narrative = await this.generateNarrative({
        mode: 'compare',
        evidence,
        question: dto.question,
      });
      evidence.agent = {
        highlights: narrative.highlights,
        action_items: narrative.action_items,
      };

      const latencyMs = Date.now() - startTime;
      analysisLatencyMs.observe({ mode: 'compare', status: 'complete' }, latencyMs);

      const updated = await this.updateAnalysisRecord(record.id, userId, {
        status: 'complete',
        evidence,
        narrative,
        latencyMs,
        appName: dataA.application?.name || dataB.application?.name || null,
        appIdB: dto.appIdB,
      });

      await this.audit.recordEvent({
        userId,
        orgId: connection.org_id,
        action: 'historical_compare_requested',
        target: updated.id,
        metadata: {
          mode: 'compare',
          appIdA: dto.appIdA,
          appIdB: dto.appIdB,
          status: updated.status,
          latencyMs,
        },
      });

      return updated;
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      analysisLatencyMs.observe({ mode: 'compare', status: 'error' }, latencyMs);
      await this.updateAnalysisRecord(record.id, userId, {
        status: 'error',
        error: (error as Error).message || 'Comparison failed',
        latencyMs,
      });
      throw error;
    }
  }

  async getHistory(userId: string, query: HistoryQueryDto) {
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
      throw new BadRequestException('Failed to fetch history');
    }

    return data || [];
  }

  async getById(userId: string, id: string) {
    const supabase = this.supabaseService.getClient();
    const userUuid = deriveUserUuid(userId);
    const { data, error } = await supabase
      .from('historical_analysis')
      .select('*')
      .eq('id', id)
      .eq('user_id', userUuid)
      .single();

    if (error || !data) {
      throw new NotFoundException('Historical analysis not found');
    }

    return data;
  }

  async updateAnalysis(userId: string, id: string, dto: UpdateHistoricalDto) {
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
      throw new NotFoundException('Historical analysis not found');
    }

    return data;
  }

  async listRuns(userId: string, orgId: string | undefined, query: RunsQueryDto, userRole?: string) {
    if (!query.appName) {
      throw new BadRequestException('appName is required');
    }

    this.validateDateRange(query.start, query.end, userRole);

    const { mcpConfig } = await this.getMcpConnection(userId, orgId);
    const runs = await this.fetchRuns(mcpConfig, query.appName, query.start, query.end, query.limit);
    return runs;
  }

  private async resolveAppId(userId: string, orgId: string | undefined, dto: AnalyzeHistoricalDto, userRole?: string) {
    if (dto.appId) {
      return { appId: dto.appId, appName: dto.appName || null, selectedBy: 'appId' };
    }

    if (!dto.appName || !dto.startTime || !dto.endTime) {
      throw new BadRequestException('Provide appId or appName + startTime + endTime');
    }

    this.validateDateRange(dto.startTime, dto.endTime, userRole);

    const { mcpConfig } = await this.getMcpConnection(userId, orgId);
    const runs = await this.fetchRuns(mcpConfig, dto.appName, dto.startTime, dto.endTime, 50);

    if (runs.length === 0) {
      throw new NotFoundException('No runs found for the specified appName and date range');
    }

    return { appId: runs[0].appId, appName: runs[0].appName, selectedBy: 'latest' };
  }

  private validateDateRange(start?: string, end?: string, userRole?: string) {
    if (!start || !end) return;
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid date range');
    }

    if (endDate < startDate) {
      throw new BadRequestException('endTime must be after startTime');
    }

    const diffMs = endDate.getTime() - startDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    const maxDays = this.getMaxRangeDays(userRole);
    if (diffDays > maxDays) {
      throw new BadRequestException(`Date range exceeds ${maxDays} days`);
    }
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

    return normalized;
  }

  private async getMcpConnection(userId: string, orgId?: string) {
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

    return { connection, mcpConfig };
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

    return {
      application,
      jobs: jobsList,
      stages: stagesList,
      executorSummary: executorSummary || {},
      environment: environment || {},
      slowStages: slowStagesList,
      sqlQueries: sqlQueriesList,
    };
  }

  private async safeSqlQueryFetch(mcpConfig: McpConnectionConfig, appId: string): Promise<any[]> {
    try {
      return await this.mcpClient.callTool<any[]>(mcpConfig, 'list_slowest_sql_queries', {
        app_id: appId,
        top_n: 5,
        include_running: false,
      });
    } catch (error) {
      this.logger.warn('SQL query metrics unavailable', { appId });
      return [];
    }
  }

  private assertBatchOnly(environment: any, appId: string) {
    const props = environment?.spark_properties || environment?.sparkProperties || [];
    const entries = Array.isArray(props) ? props : Object.entries(props || {});
    const hasStreamingProps = entries.some(([key]: any) => {
      const lower = String(key).toLowerCase();
      return lower.startsWith('spark.streaming') || lower.startsWith('spark.sql.streaming');
    });

    if (hasStreamingProps) {
      throw new BadRequestException(`Streaming applications are not supported: ${appId}`);
    }
  }

  private assertCompleted(application: any, appId: string) {
    const attempts = application?.attempts || [];
    const completed = attempts.some((attempt: any) => attempt?.completed || attempt?.endTime || attempt?.end_time);
    if (!completed) {
      throw new BadRequestException(`Application ${appId} is not completed`);
    }
  }

  private buildSummaryMetrics(data: any): AnalysisSummaryMetrics {
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
  }

  private buildHeuristics(data: any) {
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
  }

  private buildEvidenceSingle(data: any, summary: AnalysisSummaryMetrics, heuristics: any, selectedBy?: string) {
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
  }

  private buildComparison(summaryA: AnalysisSummaryMetrics, summaryB: AnalysisSummaryMetrics, nameA?: string, nameB?: string) {
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
  }

  private percentChange(a: number, b: number) {
    if (!a && !b) return 0;
    if (!a) return 100;
    return ((b - a) / a) * 100;
  }

  private async generateNarrative(params: { mode: 'single' | 'compare'; evidence: any; question?: string }) {
    const prompt = `You are generating a Spark historical analysis report.\n\nRules:\n- ONLY use the numeric values present in the JSON evidence below.\n- If a metric is missing, say "not available".\n- Cite evidence numbers directly in the narrative.\n- Provide concise highlights and action items.\n\nReturn JSON with keys: narrative_md, highlights (array of strings), action_items (array of strings).\n\nEvidence JSON:\n${JSON.stringify(params.evidence)}\n\nUser question: ${params.question || 'None'}`;

    try {
      const raw = await this.geminiService.generateHistoricalNarrative(prompt);
      const cleaned = raw.trim().replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
      const parsed = JSON.parse(cleaned);
      if (!parsed.narrative_md || !Array.isArray(parsed.highlights) || !Array.isArray(parsed.action_items)) {
        throw new Error('Invalid narrative output');
      }
      return parsed;
    } catch (error) {
      const err = error as Error;
      this.logger.warn('Narrative generation failed, using fallback', {
        error: {
          name: err.name || 'Error',
          message: err.message,
          stack: err.stack,
        },
      });
      return {
        narrative_md: this.fallbackNarrative(params),
        highlights: ['Narrative auto-generated fallback due to model error'],
        action_items: ['Review stages with highest duration and shuffle metrics.'],
      };
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
      throw new BadRequestException('Failed to create analysis record');
    }

    return data;
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
      throw new BadRequestException('Failed to update analysis record');
    }

    return data;
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
