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
    try {
      this.validateProfile = this.ajv.compile(AnalysisResponseSchema);
      this.logger.log('✅ AnalysisService initialized successfully with schema validation');
    } catch (error) {
      this.logger.error('❌ Failed to initialize AnalysisService', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  async create(userId: string, dto: CreateAnalysisDto) {
    const startTime = Date.now();

    try {
      this.logger.log('📝 Creating new analysis request', {
        userId,
        inputType: dto.inputType,
        contentLength: dto.content?.length || 0,
        hasRepoFiles: !!dto.repoFiles?.length,
        repoFilesCount: dto.repoFiles?.length || 0,
      });

      // Generate hash for caching/deduplication
      const inputHash = createHash('sha256').update(dto.content).digest('hex');
      this.logger.debug('🔑 Generated input hash for deduplication', { inputHash });

      // Check for existing analysis with same content (cache hit)
      this.logger.debug('🔍 Checking cache for existing analysis', {
        userId,
        inputHash,
        cacheWindow: '24 hours',
      });

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
        this.logger.log('✅ Cache HIT - Returning existing analysis', {
          analysisId: existing.id,
          title: existing.title,
          createdAt: existing.createdAt,
          processingMs: existing.processingMs,
          optimizationCount: existing.optimizationCount,
          severity: existing.severity,
        });
        return existing;
      }

      this.logger.debug('❌ Cache MISS - Creating new analysis record');

      // Create analysis record
      const title = dto.title || this.generateTitle(dto.content);
      const analysis = await this.prisma.analysis.create({
        data: {
          userId,
          title,
          inputType: dto.inputType,
          inputContent: dto.content,
          inputHash,
          status: 'PROCESSING',
        },
      });

      this.logger.log('✅ Analysis record created with PROCESSING status', {
        analysisId: analysis.id,
        title: analysis.title,
        status: analysis.status,
        createdAt: analysis.createdAt,
        creationDuration: Date.now() - startTime,
      });

      // Process asynchronously (don't await)
      this.logger.log('🚀 Starting async background processing', {
        analysisId: analysis.id,
        asyncMode: true,
      });

      this.processAnalysis(analysis.id, dto.content, dto.repoFiles).catch((error) => {
        this.logger.error('❌ Async processing failed - caught in create method', {
          analysisId: analysis.id,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
      });

      return analysis;
    } catch (error) {
      this.logger.error('❌ Failed to create analysis', {
        userId,
        inputType: dto.inputType,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  private async processAnalysis(analysisId: string, content: string, repoFiles: any[] = [], runtimeMetrics?: RuntimeMetrics, baseline?: ParsedEventLog) {
    const startTime = Date.now();

    try {
      this.logger.log('🔄 Processing analysis started', {
        analysisId,
        contentLength: content?.length || 0,
        hasRepoFiles: !!repoFiles?.length,
        repoFilesCount: repoFiles?.length || 0,
        hasRuntimeMetrics: !!runtimeMetrics,
        hasBaseline: !!baseline,
        tierMode: baseline ? 'TIER1' : 'TIER0',
      });

      // Call Gemini AI
      this.logger.log('🤖 Calling Gemini AI for DAG analysis', {
        analysisId,
        hasRuntimeMetrics: !!runtimeMetrics,
      });

      let result: AnalysisResult;
      let geminiStartTime = Date.now();

      try {
        result = await this.gemini.analyzeDAG(content, runtimeMetrics);

        this.logger.log('✅ Gemini AI analysis completed', {
          analysisId,
          geminiDuration: Date.now() - geminiStartTime,
          optimizationsFound: result.optimizations?.length || 0,
          dagNodesFound: result.dagNodes?.length || 0,
          hasRuntimeMetrics: !!runtimeMetrics,
        });
      } catch (geminiError) {
        this.logger.error('❌ Gemini AI call failed', {
          analysisId,
          geminiDuration: Date.now() - geminiStartTime,
          error: geminiError instanceof Error ? geminiError.message : String(geminiError),
          stack: geminiError instanceof Error ? geminiError.stack : undefined,
        });
        throw geminiError;
      }

      // --- SMART CODE MAPPING ---
      if (repoFiles && repoFiles.length > 0 && result.dagNodes) {
        this.logger.log('🗺️ Starting code mapping operation', {
          analysisId,
          dagNodesCount: result.dagNodes.length,
          repoFilesCount: repoFiles.length,
        });

        const mappingStartTime = Date.now();

        try {
          result.dagNodes = this.mapNodesToCode(result.dagNodes, repoFiles);

          const mappedCount = result.dagNodes.filter((n: any) => n.codeMapping).length;
          this.logger.log('✅ Code mapping completed', {
            analysisId,
            totalNodes: result.dagNodes.length,
            mappedNodes: mappedCount,
            unmappedNodes: result.dagNodes.length - mappedCount,
            mappingSuccessRate: `${((mappedCount / result.dagNodes.length) * 100).toFixed(1)}%`,
            mappingDuration: Date.now() - mappingStartTime,
          });
        } catch (mappingError) {
          this.logger.error('❌ Code mapping failed', {
            analysisId,
            mappingDuration: Date.now() - mappingStartTime,
            error: mappingError instanceof Error ? mappingError.message : String(mappingError),
            stack: mappingError instanceof Error ? mappingError.stack : undefined,
          });
          // Continue without mappings rather than failing the entire analysis
        }
      } else {
        this.logger.debug('⏭️ Skipping code mapping', {
          analysisId,
          reason: !repoFiles?.length ? 'No repo files provided' : 'No DAG nodes to map',
        });
      }
      // --------------------------

      // --- TIER 1 MODELING ---
      let tierMode = "TIER0";
      let baselineData = null;

      this.logger.log('📊 Starting tier model calculation', {
        analysisId,
        hasBaseline: !!baseline,
        targetTier: baseline ? 'TIER1' : 'TIER0',
      });

      const tierStartTime = Date.now();

      try {
        if (baseline) {
          tierMode = "TIER1";
          this.logger.log('⚙️ Calculating TIER1 time savings', {
            analysisId,
            baselineConfidence: baseline.baselineConfidence,
            totalRuntimeSeconds: baseline.totalRuntimeSeconds,
            optimizationsCount: result.optimizations?.length || 0,
          });

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

          this.logger.log('✅ TIER1 time savings calculated', {
            analysisId,
            confidence: baseline.baselineConfidence,
            tierDuration: Date.now() - tierStartTime,
          });
        } else {
          this.logger.log('⚙️ Enforcing TIER0 contract - null time savings', {
            analysisId,
            optimizationsCount: result.optimizations?.length || 0,
          });

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

          this.logger.log('✅ TIER0 contract enforced', {
            analysisId,
            tierDuration: Date.now() - tierStartTime,
          });
        }
      } catch (tierError) {
        this.logger.error('❌ Tier model calculation failed', {
          analysisId,
          tierMode,
          tierDuration: Date.now() - tierStartTime,
          error: tierError instanceof Error ? tierError.message : String(tierError),
          stack: tierError instanceof Error ? tierError.stack : undefined,
        });
        throw tierError;
      }

      // Construct Final Response
      const finalResponse: any = {
        ...result,
        tierMode,
        baseline: baselineData,
        optimizations: result.optimizations,
      };

      // --- VALIDATION ---
      this.logger.log('🔍 Validating analysis response schema', {
        analysisId,
        tierMode,
        hasOptimizations: !!result.optimizations?.length,
      });

      const validationStartTime = Date.now();
      const valid = this.validateProfile(finalResponse);

      if (!valid) {
        this.logger.error('❌ Analysis response validation failed', {
          analysisId,
          tierMode,
          validationErrors: this.validateProfile.errors,
          validationDuration: Date.now() - validationStartTime,
        });

        this.logger.warn('⚠️ Stripping Tier 1 data due to validation failure - reverting to TIER0', {
          analysisId,
          originalTier: tierMode,
          fallbackTier: 'TIER0',
        });

        finalResponse.tierMode = "TIER0";
        finalResponse.baseline = { confidence: "insufficient", totalRuntimeSeconds: null, topBottlenecks: [] };
        finalResponse.optimizations = finalResponse.optimizations.map((opt: Optimization) => ({ ...opt, timeSavings: this.getNullTimeSavings() }));
      } else {
        this.logger.log('✅ Analysis response validation passed', {
          analysisId,
          tierMode,
          validationDuration: Date.now() - validationStartTime,
        });
      }

      // Extract denormalized fields
      const severity = this.getHighestSeverity(result.optimizations);
      const optimizationCount = result.optimizations?.length || 0;
      const dagNodeCount = result.dagNodes?.length || 0;

      this.logger.log('📈 Analysis summary extracted', {
        analysisId,
        severity,
        optimizationCount,
        dagNodeCount,
      });

      // Update analysis with results
      this.logger.log('💾 Updating analysis status: PROCESSING → COMPLETED', {
        analysisId,
        processingMs: Date.now() - startTime,
      });

      const updateStartTime = Date.now();

      try {
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

        this.logger.log('✅ Analysis status updated to COMPLETED', {
          analysisId,
          updateDuration: Date.now() - updateStartTime,
        });
      } catch (updateError) {
        this.logger.error('❌ Failed to update analysis to COMPLETED', {
          analysisId,
          updateDuration: Date.now() - updateStartTime,
          error: updateError instanceof Error ? updateError.message : String(updateError),
          stack: updateError instanceof Error ? updateError.stack : undefined,
        });
        throw updateError;
      }

      // Get analysis to find userId
      try {
        const analysis = await this.prisma.analysis.findUnique({
          where: { id: analysisId },
          select: { userId: true },
        });

        // Update user's analysis count
        if (analysis) {
          this.logger.debug('📊 Updating user analysis count', {
            analysisId,
            userId: analysis.userId,
          });

          await this.prisma.user.update({
            where: { id: analysis.userId },
            data: {
              analysisCount: { increment: 1 },
              lastAnalysisAt: new Date(),
            },
          });

          this.logger.debug('✅ User analysis count updated', {
            userId: analysis.userId,
          });
        }
      } catch (userUpdateError) {
        this.logger.error('❌ Failed to update user analysis count', {
          analysisId,
          error: userUpdateError instanceof Error ? userUpdateError.message : String(userUpdateError),
          stack: userUpdateError instanceof Error ? userUpdateError.stack : undefined,
        });
        // Don't throw - this is not critical
      }

      this.logger.log('✅ Analysis processing completed successfully', {
        analysisId,
        totalDuration: Date.now() - startTime,
        severity,
        optimizationCount,
        dagNodeCount,
        tierMode: finalResponse.tierMode,
      });
    } catch (error) {
      const errorDuration = Date.now() - startTime;

      this.logger.error('❌ Analysis processing failed', {
        analysisId,
        duration: errorDuration,
        error: error instanceof Error ? error.message : String(error),
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Update analysis status to FAILED
      this.logger.log('💾 Updating analysis status: PROCESSING → FAILED', {
        analysisId,
        errorMessage: error instanceof Error ? error.message : 'Unknown error occurred',
      });

      try {
        await this.prisma.analysis.update({
          where: { id: analysisId },
          data: {
            status: 'FAILED',
            errorMessage:
              error instanceof Error ? error.message : 'Unknown error occurred',
            processingMs: errorDuration,
          },
        });

        this.logger.log('✅ Analysis status updated to FAILED', {
          analysisId,
        });
      } catch (failUpdateError) {
        this.logger.error('❌ Failed to update analysis to FAILED status', {
          analysisId,
          error: failUpdateError instanceof Error ? failUpdateError.message : String(failUpdateError),
          stack: failUpdateError instanceof Error ? failUpdateError.stack : undefined,
        });
      }
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
    this.logger.debug('🗺️ Mapping DAG nodes to code files', {
      dagNodesCount: dagNodes.length,
      repoFilesCount: repoFiles.length,
    });

    return dagNodes.map((node, index) => {
      try {
        // 1. Extract Keywords
        const keywords: string[] = [];
        const desc = node.description || "";
        const op = node.operation || "";

        this.logger.debug('🔍 Processing node for code mapping', {
          nodeIndex: index,
          nodeId: node.id,
          operation: op,
          descriptionLength: desc.length,
        });

        // Extract table names (e.g., "scan parquet default.transactions")
        const tableMatch = desc.match(/(?:from|scan|table)\s+([a-zA-Z0-9_]+\.[a-zA-Z0-9_]+)/i);
        if (tableMatch) {
          keywords.push(tableMatch[1]);
          this.logger.debug('📋 Found table name keyword', {
            nodeId: node.id,
            keyword: tableMatch[1],
          });
        }

        // Extract paths (e.g., "s3://bucket/path")
        const pathMatch = desc.match(/(?:s3|abfss?|gs):\/\/[^\s]+/);
        if (pathMatch) {
          // Use the last part of the path as a keyword
          const parts = pathMatch[0].split('/');
          const folder = parts[parts.length - 2];
          const file = parts[parts.length - 1];
          if (folder) keywords.push(folder);
          if (file) keywords.push(file);

          this.logger.debug('📁 Found path keywords', {
            nodeId: node.id,
            path: pathMatch[0],
            keywords: [folder, file].filter(Boolean),
          });
        }

        // 2. Search in Files
        let bestMatch: any = null;

        // Only search if we have significant keywords
        if (keywords.length > 0) {
          this.logger.debug('🔎 Searching files for keywords', {
            nodeId: node.id,
            keywordsCount: keywords.length,
            keywords,
          });

          for (const file of repoFiles) {
            // Skip binary or gigantic files
            if (file.size > 500000) {
              this.logger.debug('⏭️ Skipping large file', {
                filePath: file.path,
                fileSize: file.size,
              });
              continue;
            }

            for (const keyword of keywords) {
              if (file.content.includes(keyword)) {
                // Found a match!
                bestMatch = {
                  filePath: file.path,
                  line: this.findLineNumber(file.content, keyword),
                  confidence: 'High'
                };

                this.logger.debug('✅ Code mapping match found', {
                  nodeId: node.id,
                  filePath: file.path,
                  keyword,
                  line: bestMatch.line,
                });

                break;
              }
            }
            if (bestMatch) break;
          }

          if (!bestMatch) {
            this.logger.debug('❌ No code mapping found', {
              nodeId: node.id,
              keywords,
            });
          }
        } else {
          this.logger.debug('⏭️ No keywords extracted for mapping', {
            nodeId: node.id,
          });
        }

        return {
          ...node,
          codeMapping: bestMatch
        };
      } catch (nodeError) {
        this.logger.error('❌ Failed to map node to code', {
          nodeIndex: index,
          nodeId: node?.id,
          error: nodeError instanceof Error ? nodeError.message : String(nodeError),
        });
        // Return node without mapping rather than failing
        return {
          ...node,
          codeMapping: null
        };
      }
    });
  }

  private findLineNumber(content: string, term: string): number {
    try {
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(term)) return i + 1;
      }
      return 1;
    } catch (error) {
      this.logger.error('❌ Failed to find line number', {
        term,
        error: error instanceof Error ? error.message : String(error),
      });
      return 1;
    }
  }

  private generateTitle(content: string): string {
    try {
      this.logger.debug('📝 Generating analysis title');

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
      const title = firstLine.length > 50
        ? firstLine.substring(0, 47) + '...'
        : firstLine;

      this.logger.debug('✅ Title generated', { title });
      return title;
    } catch (error) {
      this.logger.error('❌ Failed to generate title', {
        error: error instanceof Error ? error.message : String(error),
      });
      return 'Untitled Analysis';
    }
  }

  private getHighestSeverity(
    optimizations: AnalysisResult['optimizations'],
  ): Severity | null {
    try {
      if (!optimizations?.length) {
        this.logger.debug('No optimizations to determine severity');
        return null;
      }

      const severityOrder: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

      for (const sev of severityOrder) {
        if (
          optimizations.some(
            (o) => o.severity?.toUpperCase() === sev,
          )
        ) {
          this.logger.debug('Highest severity determined', { severity: sev });
          return sev;
        }
      }

      return null;
    } catch (error) {
      this.logger.error('❌ Failed to determine highest severity', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async getRecent(userId: string) {
    try {
      this.logger.debug('📊 Fetching recent analyses', { userId });

      const analyses = await this.prisma.analysis.findMany({
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

      this.logger.log('✅ Recent analyses fetched', {
        userId,
        count: analyses.length,
      });

      return analyses;
    } catch (error) {
      this.logger.error('❌ Failed to fetch recent analyses', {
        userId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  async findAll(userId: string, query: AnalysisQueryDto) {
    try {
      const { page = 1, limit = 10, status, severity, search, startDate, endDate } = query;
      const skip = (page - 1) * limit;

      this.logger.debug('🔍 Finding all analyses with filters', {
        userId,
        page,
        limit,
        status,
        severity,
        search,
        startDate,
        endDate,
      });

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

      this.logger.log('✅ Analyses fetched successfully', {
        userId,
        page,
        limit,
        resultCount: analyses.length,
        total,
        hasFilters: !!(status || severity || search || startDate || endDate),
      });

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
    } catch (error) {
      this.logger.error('❌ Failed to find all analyses', {
        userId,
        query,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  async findOne(userId: string, analysisId: string) {
    try {
      this.logger.debug('🔍 Finding analysis by ID', {
        userId,
        analysisId,
      });

      const analysis = await this.prisma.analysis.findFirst({
        where: {
          id: analysisId,
          userId,
        },
      });

      if (!analysis) {
        this.logger.warn('❌ Analysis not found', {
          userId,
          analysisId,
        });
        throw new NotFoundException('Analysis not found');
      }

      this.logger.log('✅ Analysis found', {
        analysisId,
        title: analysis.title,
        status: analysis.status,
      });

      return analysis;
    } catch (error) {
      this.logger.error('❌ Failed to find analysis', {
        userId,
        analysisId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  async getStatus(userId: string, analysisId: string) {
    try {
      this.logger.debug('🔍 Getting analysis status', {
        userId,
        analysisId,
      });

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
        this.logger.warn('❌ Analysis not found for status check', {
          userId,
          analysisId,
        });
        throw new NotFoundException('Analysis not found');
      }

      this.logger.log('✅ Analysis status retrieved', {
        analysisId,
        status: analysis.status,
        processingMs: analysis.processingMs,
        hasError: !!analysis.errorMessage,
      });

      return analysis;
    } catch (error) {
      this.logger.error('❌ Failed to get analysis status', {
        userId,
        analysisId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  async update(userId: string, analysisId: string, dto: { title?: string }) {
    try {
      this.logger.log('📝 Updating analysis', {
        userId,
        analysisId,
        hasTitle: !!dto.title,
      });

      const analysis = await this.prisma.analysis.findFirst({
        where: { id: analysisId, userId },
      });

      if (!analysis) {
        this.logger.warn('❌ Analysis not found for update', {
          userId,
          analysisId,
        });
        throw new NotFoundException('Analysis not found');
      }

      const updated = await this.prisma.analysis.update({
        where: { id: analysisId },
        data: {
          ...(dto.title && { title: dto.title }),
        },
      });

      this.logger.log('✅ Analysis updated successfully', {
        analysisId,
        newTitle: dto.title,
      });

      return updated;
    } catch (error) {
      this.logger.error('❌ Failed to update analysis', {
        userId,
        analysisId,
        dto,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  async delete(userId: string, analysisId: string) {
    try {
      this.logger.log('🗑️ Deleting analysis', {
        userId,
        analysisId,
      });

      const analysis = await this.prisma.analysis.findFirst({
        where: { id: analysisId, userId },
      });

      if (!analysis) {
        this.logger.warn('❌ Analysis not found for deletion', {
          userId,
          analysisId,
        });
        throw new NotFoundException('Analysis not found');
      }

      await this.prisma.analysis.delete({
        where: { id: analysisId },
      });

      this.logger.log('✅ Analysis deleted successfully', {
        analysisId,
        title: analysis.title,
      });

      return { success: true, message: 'Analysis deleted successfully' };
    } catch (error) {
      this.logger.error('❌ Failed to delete analysis', {
        userId,
        analysisId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  async retry(userId: string, analysisId: string) {
    try {
      this.logger.log('🔄 Retrying failed analysis', {
        userId,
        analysisId,
      });

      const analysis = await this.prisma.analysis.findFirst({
        where: {
          id: analysisId,
          userId,
          status: 'FAILED',
        },
      });

      if (!analysis) {
        this.logger.warn('❌ Analysis not found or not in failed state', {
          userId,
          analysisId,
        });
        throw new NotFoundException(
          'Analysis not found or not in failed state',
        );
      }

      this.logger.log('💾 Resetting analysis status: FAILED → PROCESSING', {
        analysisId,
      });

      // Reset status
      await this.prisma.analysis.update({
        where: { id: analysisId },
        data: {
          status: 'PROCESSING',
          errorMessage: null,
          processingMs: null,
        },
      });

      this.logger.log('✅ Analysis status reset, starting retry', {
        analysisId,
      });

      // Reprocess
      this.processAnalysis(analysisId, analysis.inputContent).catch((error) => {
        this.logger.error('❌ Retry processing failed', {
          analysisId,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
      });

      return {
        success: true,
        message: 'Analysis retry started',
        analysisId,
      };
    } catch (error) {
      this.logger.error('❌ Failed to retry analysis', {
        userId,
        analysisId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  async uploadEventLog(userId: string, analysisId: string, fileBuffer: Buffer, originalFilename: string) {
    const startTime = Date.now();

    try {
      this.logger.log('📤 Starting event log upload', {
        userId,
        analysisId,
        filename: originalFilename,
        fileSize: fileBuffer.length,
      });

      const analysis = await this.prisma.analysis.findFirst({
        where: { id: analysisId, userId },
      });

      if (!analysis) {
        this.logger.warn('❌ Analysis not found for event log upload', {
          userId,
          analysisId,
        });
        throw new NotFoundException('Analysis not found');
      }

      // 1. Save file temporarily (in real prod, upload to S3/GCS)
      const tempPath = `/tmp/${analysisId}_${originalFilename}`;

      try {
        require('fs').writeFileSync(tempPath, fileBuffer);
        this.logger.log('✅ Event log file saved temporarily', {
          analysisId,
          tempPath,
          fileSize: fileBuffer.length,
        });
      } catch (writeError) {
        this.logger.error('❌ Failed to write event log file', {
          analysisId,
          tempPath,
          error: writeError instanceof Error ? writeError.message : String(writeError),
        });
        throw writeError;
      }

      try {
        // 2. Parse Log
        this.logger.log('🔍 Parsing event log file', {
          analysisId,
          tempPath,
        });

        const parseStartTime = Date.now();
        const parsed = await this.eventLogParser.parseLogFile(tempPath);

        this.logger.log('✅ Event log parsed successfully', {
          analysisId,
          parseDuration: Date.now() - parseStartTime,
          applicationId: parsed.applicationId,
          totalRuntimeSeconds: parsed.totalRuntimeSeconds,
          stagesCount: parsed.stages?.length || 0,
          bottlenecksCount: parsed.bottlenecks?.length || 0,
          baselineConfidence: parsed.baselineConfidence,
        });

        // 3. Save Baseline
        this.logger.log('💾 Saving runtime baseline', {
          analysisId,
        });

        const baselineStartTime = Date.now();

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

        this.logger.log('✅ Runtime baseline saved', {
          analysisId,
          baselineDuration: Date.now() - baselineStartTime,
        });

        // 4. Record Event Log
        this.logger.log('💾 Recording event log metadata', {
          analysisId,
        });

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

        this.logger.log('✅ Event log metadata recorded', {
          analysisId,
        });

        // 5. Re-Analyze in Tier 1 Mode
        this.logger.log('🔄 Re-analyzing with TIER1 runtime metrics', {
          analysisId,
        });

        await this.prisma.analysis.update({
          where: { id: analysisId },
          data: { status: 'PROCESSING' }
        });

        this.logger.log('💾 Analysis status updated: COMPLETED → PROCESSING (for TIER1)', {
          analysisId,
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

        this.logger.log('🚀 Starting TIER1 async reprocessing', {
          analysisId,
          runtimeMetrics: {
            totalRuntimeSeconds: runtimeMetrics.totalRuntimeSeconds,
            stagesCount: runtimeMetrics.stages.length,
            bottlenecksCount: runtimeMetrics.bottlenecks.length,
          },
        });

        this.processAnalysis(analysisId, analysis.inputContent, [], runtimeMetrics, parsed).catch(err => {
          this.logger.error('❌ TIER1 re-analysis failed', {
            analysisId,
            error: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
          });
        });

        this.logger.log('✅ Event log upload completed successfully', {
          analysisId,
          totalDuration: Date.now() - startTime,
        });

        return { success: true, message: 'Event log processed. Tier 1 Analysis started.' };

      } catch (error) {
        this.logger.error('❌ Event log processing failed', {
          analysisId,
          filename: originalFilename,
          duration: Date.now() - startTime,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        throw new BadRequestException('Failed to parse event log. Ensure it is a valid Spark event log (JSON/JSON.gz).');
      }
    } catch (error) {
      this.logger.error('❌ Event log upload failed', {
        userId,
        analysisId,
        filename: originalFilename,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  async useDemoEventLog(userId: string, analysisId: string) {
    try {
      this.logger.log('📋 Using demo event log', {
        userId,
        analysisId,
      });

      const demoFilePath = path.join(process.cwd(), 'test/fixtures/demo_event_log.json');

      this.logger.debug('🔍 Checking demo event log file', {
        demoFilePath,
      });

      if (!fs.existsSync(demoFilePath)) {
        this.logger.error('❌ Demo event log file not found', {
          demoFilePath,
        });
        throw new BadRequestException('Demo event log file not found on server. Path: ' + demoFilePath);
      }

      const fileBuffer = fs.readFileSync(demoFilePath);

      this.logger.log('✅ Demo event log file read', {
        demoFilePath,
        fileSize: fileBuffer.length,
      });

      return this.uploadEventLog(userId, analysisId, fileBuffer, 'demo_event_log.json');
    } catch (error) {
      this.logger.error('❌ Failed to use demo event log', {
        userId,
        analysisId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }
}
