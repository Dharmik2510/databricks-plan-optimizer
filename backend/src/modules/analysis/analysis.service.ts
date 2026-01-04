import {
  Injectable,
  NotFoundException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GeminiService, RuntimeMetrics, AnalysisResult } from '../../integrations/gemini/gemini.service';
import { CreateAnalysisDto, AnalysisQueryDto } from './dto';
import { createHash } from 'crypto';
import { AnalysisStatus, Severity, Prisma } from '@prisma/client';
import { EventLogParser, ParsedEventLog } from './event-log.parser';
import { Tier1ModelService, Optimization } from './tier1-model.service';
import { AnalysisResponseSchema } from './analysis.schema';
import * as fs from 'fs';
import * as path from 'path';
import Ajv from 'ajv';

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);
  private readonly ajv = new Ajv();
  private validateProfile: any;

  constructor(
    private prisma: PrismaService,
    private gemini: GeminiService,
    private eventLogParser: EventLogParser,
    private tier1Model: Tier1ModelService,
  ) {
    this.validateProfile = this.ajv.compile(AnalysisResponseSchema);
    console.log('[AnalysisService] Initialized successfully');
  }

  async create(userId: string, dto: CreateAnalysisDto) {
    // Generate hash for caching/deduplication
    const inputHash = createHash('sha256').update(dto.content).digest('hex');

    // Check for existing analysis with same content (cache hit)
    const existing = await this.prisma.analysis.findFirst({
      where: {
        userId,
        inputHash,
        status: 'COMPLETED',
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
    });

    if (existing) {
      this.logger.log(`Cache hit for analysis: ${existing.id}`);
      return existing;
    }

    // Create analysis record
    const analysis = await this.prisma.analysis.create({
      data: {
        userId,
        title: dto.title || this.generateTitle(dto.content),
        inputType: dto.inputType,
        inputContent: dto.content,
        inputHash,
        status: 'PROCESSING',
      },
    });

    // Process asynchronously (don't await)
    this.processAnalysis(analysis.id, dto.content, dto.repoFiles).catch((error) => {
      this.logger.error(`Failed to process analysis ${analysis.id}:`, error);
    });

    return analysis;
  }

  private async processAnalysis(analysisId: string, content: string, repoFiles: any[] = [], runtimeMetrics?: RuntimeMetrics, baseline?: ParsedEventLog) {
    const startTime = Date.now();

    try {
      this.logger.log(`Processing analysis: ${analysisId}`);

      // Call Gemini AI
      const result = await this.gemini.analyzeDAG(content, runtimeMetrics);

      // --- SMART CODE MAPPING ---
      if (repoFiles && repoFiles.length > 0 && result.dagNodes) {
        this.logger.log(`Mapping ${result.dagNodes.length} DAG nodes to ${repoFiles.length} files...`);
        result.dagNodes = this.mapNodesToCode(result.dagNodes, repoFiles);
      }
      // --------------------------

      // --- TIER 1 MODELING ---
      let tierMode = "TIER0";
      let baselineData = null;

      if (baseline) {
        tierMode = "TIER1";
        // Calculate Time Savings
        result.optimizations = this.tier1Model.calculateTimeSavings(
          baseline,
          result.optimizations as Optimization[],
          baseline.baselineConfidence
        ) as any;

        baselineData = {
          confidence: baseline.baselineConfidence,
          totalRuntimeSeconds: baseline.totalRuntimeSeconds || null,
          topBottlenecks: baseline.bottlenecks
        };
      } else {
        // Enforce Tier 0 contract
        result.optimizations = result.optimizations.map(opt => ({
          ...opt,
          timeSavings: this.getNullTimeSavings()
        })) as any;

        baselineData = {
          confidence: "insufficient",
          totalRuntimeSeconds: null,
          topBottlenecks: []
        };
      }

      // Construct Final Response
      const finalResponse: any = {
        ...result,
        tierMode,
        baseline: baselineData,
        optimizations: result.optimizations,
      };

      // --- VALIDATION ---
      const valid = this.validateProfile(finalResponse);
      if (!valid) {
        this.logger.error('Analysis response validation failed', this.validateProfile.errors);
        // Fallback to safe Tier 0 if validation fails? 
        // For now, allow but log error, or maybe strip savings.
        // Let's strip savings if validation fails to match "Strict validation"
        this.logger.warn('Stripping Tier 1 data due to validation failure to ensure safety.');
        finalResponse.tierMode = "TIER0";
        finalResponse.baseline = { confidence: "insufficient", totalRuntimeSeconds: null, topBottlenecks: [] };
        finalResponse.optimizations = finalResponse.optimizations.map((opt: Optimization) => ({ ...opt, timeSavings: this.getNullTimeSavings() }));
      }

      // Extract denormalized fields
      const severity = this.getHighestSeverity(result.optimizations);
      const optimizationCount = result.optimizations?.length || 0;
      const dagNodeCount = result.dagNodes?.length || 0;

      // Update analysis with results
      await this.prisma.analysis.update({
        where: { id: analysisId },
        data: {
          status: 'COMPLETED',
          result: finalResponse as unknown as Prisma.JsonObject,
          severity,
          optimizationCount,
          dagNodeCount,
          processingMs: Date.now() - startTime,
          aiModel: 'gemini-2.0-flash',
        },
      });

      // Get analysis to find userId
      const analysis = await this.prisma.analysis.findUnique({
        where: { id: analysisId },
        select: { userId: true },
      });

      // Update user's analysis count
      if (analysis) {
        await this.prisma.user.update({
          where: { id: analysis.userId },
          data: {
            analysisCount: { increment: 1 },
            lastAnalysisAt: new Date(),
          },
        });
      }

      this.logger.log(
        `Analysis completed: ${analysisId} in ${Date.now() - startTime}ms`,
      );
    } catch (error) {
      this.logger.error(`Analysis failed: ${analysisId}`, error);

      await this.prisma.analysis.update({
        where: { id: analysisId },
        data: {
          status: 'FAILED',
          errorMessage:
            error instanceof Error ? error.message : 'Unknown error occurred',
          processingMs: Date.now() - startTime,
        },
      });
    }
  }

  private getNullTimeSavings() {
    return {
      estimatedSecondsSaved: null,
      estimatedPercentSaved: null,
      estimateBasis: null,
      confidence: null,
      evidenceStageIds: []
    };
  }

  // Heuristic to link Plan Nodes -> Code Files
  private mapNodesToCode(dagNodes: any[], repoFiles: any[]): any[] {
    return dagNodes.map(node => {
      // 1. Extract Keywords
      const keywords: string[] = [];
      const desc = node.description || "";
      const op = node.operation || "";

      // Extract table names (e.g., "scan parquet default.transactions")
      const tableMatch = desc.match(/(?:from|scan|table)\s+([a-zA-Z0-9_]+\.[a-zA-Z0-9_]+)/i);
      if (tableMatch) keywords.push(tableMatch[1]);

      // Extract paths (e.g., "s3://bucket/path")
      const pathMatch = desc.match(/(?:s3|abfss?|gs):\/\/[^\s]+/);
      if (pathMatch) {
        // Use the last part of the path as a keyword
        const parts = pathMatch[0].split('/');
        const folder = parts[parts.length - 2];
        const file = parts[parts.length - 1];
        if (folder) keywords.push(folder);
        if (file) keywords.push(file);
      }

      // 2. Search in Files
      let bestMatch: any = null;

      // Only search if we have significant keywords
      if (keywords.length > 0) {
        for (const file of repoFiles) {
          // Skip binary or gigantic files
          if (file.size > 500000) continue;

          for (const keyword of keywords) {
            if (file.content.includes(keyword)) {
              // Found a match!
              // Simple confidence: if exact match of a full table name
              bestMatch = {
                filePath: file.path,
                // Try to find line number
                line: this.findLineNumber(file.content, keyword),
                confidence: 'High'
              };
              break;
            }
          }
          if (bestMatch) break;
        }
      }

      return {
        ...node,
        codeMapping: bestMatch
      };
    });
  }

  private findLineNumber(content: string, term: string): number {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(term)) return i + 1;
    }
    return 1;
  }

  private generateTitle(content: string): string {
    // Extract a meaningful title from content
    const lines = content.split('\n').filter((line) => line.trim());
    const firstLine = lines[0] || 'Untitled Analysis';

    // Look for common patterns
    if (content.includes('Physical Plan')) {
      return 'Spark Physical Plan Analysis';
    }
    if (content.includes('EXPLAIN')) {
      return 'SQL Explain Analysis';
    }

    // Truncate if too long
    return firstLine.length > 50
      ? firstLine.substring(0, 47) + '...'
      : firstLine;
  }

  private getHighestSeverity(
    optimizations: AnalysisResult['optimizations'],
  ): Severity | null {
    if (!optimizations?.length) return null;

    const severityOrder: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

    for (const sev of severityOrder) {
      if (
        optimizations.some(
          (o) => o.severity?.toUpperCase() === sev,
        )
      ) {
        return sev;
      }
    }

    return null;
  }

  async getRecent(userId: string) {
    return this.prisma.analysis.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        title: true,
        inputType: true,
        status: true,
        severity: true,
        processingMs: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findAll(userId: string, query: AnalysisQueryDto) {
    const { page = 1, limit = 10, status, severity, search, startDate, endDate } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.AnalysisWhereInput = {
      userId,
      ...(status && { status }),
      ...(severity && { severity }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...((startDate || endDate) && {
        createdAt: {
          ...(startDate && { gte: new Date(startDate) }),
          ...(endDate && { lte: new Date(endDate) }),
        },
      }),
    };

    const [analyses, total] = await Promise.all([
      this.prisma.analysis.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          inputType: true,
          status: true,
          severity: true,
          optimizationCount: true,
          dagNodeCount: true,
          processingMs: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.analysis.count({ where }),
    ]);

    return {
      data: analyses,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + analyses.length < total,
      },
    };
  }

  async findOne(userId: string, analysisId: string) {
    const analysis = await this.prisma.analysis.findFirst({
      where: {
        id: analysisId,
        userId,
      },
    });

    if (!analysis) {
      throw new NotFoundException('Analysis not found');
    }

    return analysis;
  }

  async getStatus(userId: string, analysisId: string) {
    const analysis = await this.prisma.analysis.findFirst({
      where: {
        id: analysisId,
        userId,
      },
      select: {
        id: true,
        status: true,
        errorMessage: true,
        processingMs: true,
        updatedAt: true,
      },
    });

    if (!analysis) {
      throw new NotFoundException('Analysis not found');
    }

    return analysis;
  }

  async update(userId: string, analysisId: string, dto: { title?: string }) {
    const analysis = await this.prisma.analysis.findFirst({
      where: { id: analysisId, userId },
    });

    if (!analysis) {
      throw new NotFoundException('Analysis not found');
    }

    return this.prisma.analysis.update({
      where: { id: analysisId },
      data: {
        ...(dto.title && { title: dto.title }),
      },
    });
  }

  async delete(userId: string, analysisId: string) {
    const analysis = await this.prisma.analysis.findFirst({
      where: { id: analysisId, userId },
    });

    if (!analysis) {
      throw new NotFoundException('Analysis not found');
    }

    await this.prisma.analysis.delete({
      where: { id: analysisId },
    });

    return { success: true, message: 'Analysis deleted successfully' };
  }

  async retry(userId: string, analysisId: string) {
    const analysis = await this.prisma.analysis.findFirst({
      where: {
        id: analysisId,
        userId,
        status: 'FAILED',
      },
    });

    if (!analysis) {
      throw new NotFoundException(
        'Analysis not found or not in failed state',
      );
    }

    // Reset status
    await this.prisma.analysis.update({
      where: { id: analysisId },
      data: {
        status: 'PROCESSING',
        errorMessage: null,
        processingMs: null,
      },
    });

    // Reprocess
    this.processAnalysis(analysisId, analysis.inputContent).catch((error) => {
      this.logger.error(`Retry failed for analysis ${analysisId}:`, error);
    });

    return {
      success: true,
      message: 'Analysis retry started',
      analysisId,
    };
  }

  async uploadEventLog(userId: string, analysisId: string, fileBuffer: Buffer, originalFilename: string) {
    const analysis = await this.prisma.analysis.findFirst({
      where: { id: analysisId, userId },
    });

    if (!analysis) {
      throw new NotFoundException('Analysis not found');
    }

    // 1. Save file temporarily (in real prod, upload to S3/GCS)
    const tempPath = `/tmp/${analysisId}_${originalFilename}`;
    require('fs').writeFileSync(tempPath, fileBuffer);

    try {
      // 2. Parse Log
      this.logger.log(`Parsing event log for analysis ${analysisId}...`);
      const parsed = await this.eventLogParser.parseLogFile(tempPath);

      // 3. Save Baseline
      await this.prisma.analysisRuntimeBaseline.upsert({
        where: { analysisId },
        create: {
          analysisId,
          applicationId: parsed.applicationId,
          baselineExecutionTimeSeconds: parsed.totalRuntimeSeconds,
          stages: parsed.stages as any,
          bottlenecks: parsed.bottlenecks as any
        },
        update: {
          applicationId: parsed.applicationId,
          baselineExecutionTimeSeconds: parsed.totalRuntimeSeconds,
          stages: parsed.stages as any,
          bottlenecks: parsed.bottlenecks as any
        }
      });

      // 4. Record Event Log
      await this.prisma.analysisEventLog.upsert({
        where: { analysisId },
        create: {
          analysisId,
          originalFilename,
          storagePath: tempPath, // In real app, S3 URL
          parsed: true
        },
        update: {
          originalFilename,
          storagePath: tempPath,
          parsed: true
        }
      });

      // 5. Re-Analyze in Tier 1 Mode
      this.logger.log(`Re-analyzing ${analysisId} with Tier 1 Runtime Metrics...`);
      await this.prisma.analysis.update({
        where: { id: analysisId },
        data: { status: 'PROCESSING' }
      });

      const runtimeMetrics = {
        totalRuntimeSeconds: parsed.totalRuntimeSeconds,
        stages: parsed.stages.map(s => ({
          stageId: s.stageId,
          name: s.name,
          durationSeconds: s.durationSeconds
        })),
        bottlenecks: parsed.bottlenecks
      };

      this.processAnalysis(analysisId, analysis.inputContent, [], runtimeMetrics, parsed).catch(err => {
        this.logger.error(`Tier 1 Re-analysis failed: ${err}`);
        // Revert status to completed if fails? Or keep failed.
      });

      return { success: true, message: 'Event log processed. Tier 1 Analysis started.' };

    } catch (error) {
      this.logger.error(`Event log upload failed: ${error}`);
      throw new BadRequestException('Failed to parse event log. Ensure it is a valid Spark event log (JSON/JSON.gz).');
      // cleanup temp file if needed, or keep for debugging
      // require('fs').unlinkSync(tempPath);
    }
  }

  async useDemoEventLog(userId: string, analysisId: string) {
    const demoFilePath = path.join(process.cwd(), 'test/fixtures/demo_event_log.json');

    if (!fs.existsSync(demoFilePath)) {
      throw new BadRequestException('Demo event log file not found on server. Path: ' + demoFilePath);
    }

    const fileBuffer = fs.readFileSync(demoFilePath);
    return this.uploadEventLog(userId, analysisId, fileBuffer, 'demo_event_log.json');
  }
}

