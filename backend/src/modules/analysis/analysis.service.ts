import {
  Injectable,
  NotFoundException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GeminiService } from '../../integrations/gemini/gemini.service';
import { CreateAnalysisDto, AnalysisQueryDto } from './dto';
import { createHash } from 'crypto';
import { AnalysisStatus, Severity, Prisma } from '@prisma/client';

export interface AnalysisResult {
  summary: string;
  dagNodes: Array<{
    id: string;
    name: string;
    type: string;
    metric?: string;
  }>;
  dagLinks: Array<{
    source: string;
    target: string;
  }>;
  resourceMetrics: Array<{
    stageId: string;
    cpuPercentage: number;
    memoryMb: number;
  }>;
  optimizations: Array<{
    title: string;
    severity: string;
    description: string;
    codeSuggestion?: string;
    originalPattern?: string;
  }>;
  codeMappings?: Array<{
    filePath: string;
    lineNumber: number;
    code: string;
    relevanceExplanation: string;
  }>;
  estimatedDurationMin?: number;
}

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(
    private prisma: PrismaService,
    private gemini: GeminiService,
  ) {}

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
    this.processAnalysis(analysis.id, dto.content).catch((error) => {
      this.logger.error(`Failed to process analysis ${analysis.id}:`, error);
    });

    return analysis;
  }

  private async processAnalysis(analysisId: string, content: string) {
    const startTime = Date.now();

    try {
      this.logger.log(`Processing analysis: ${analysisId}`);

      // Call Gemini AI
      const result = await this.gemini.analyzeDAG(content);

      // Extract denormalized fields
      const severity = this.getHighestSeverity(result.optimizations);
      const optimizationCount = result.optimizations?.length || 0;
      const dagNodeCount = result.dagNodes?.length || 0;

      // Update analysis with results
      await this.prisma.analysis.update({
        where: { id: analysisId },
        data: {
          status: 'COMPLETED',
          result: result as unknown as Prisma.JsonObject,
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

  async findAll(userId: string, query: AnalysisQueryDto) {
    const { page = 1, limit = 10, status, severity } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.AnalysisWhereInput = {
      userId,
      ...(status && { status }),
      ...(severity && { severity }),
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
}
