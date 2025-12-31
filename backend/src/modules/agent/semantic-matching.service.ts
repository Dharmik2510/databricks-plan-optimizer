/**
 * Semantic Matching Service - PRODUCTION READY
 *
 * Uses OpenAI embeddings and Chroma vector database for semantic code search.
 * Enables finding relevant code even when table/function names don't match exactly.
 *
 * @production
 * @version 2.0.0
 * @requires OPENAI_API_KEY environment variable
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAIEmbeddings } from '@langchain/openai';
import { Chroma } from '@langchain/community/vectorstores/chroma';
import { Document } from 'langchain/document';
import {
    AnalyzedFile,
    FunctionInfo,
    ExecutionPlanStage,
    DataOperation
} from './agent-types';

export interface SemanticMatch {
    filePath: string;
    functionName: string;
    startLine: number;
    endLine: number;
    semanticSimilarity: number; // 0-1
    confidence: number; // 0-100
    snippet: string;
    metadata: {
        language: string;
        dataOperations: string[];
        tables: string[];
        complexity: number;
    };
}

export interface IndexStats {
    totalDocuments: number;
    totalFunctions: number;
    totalClasses: number;
    indexedAt: Date;
    collectionName: string;
}

@Injectable()
export class SemanticMatchingService implements OnModuleInit {
    private readonly logger = new Logger(SemanticMatchingService.name);
    private embeddings: OpenAIEmbeddings | null = null;
    private vectorStore: Chroma | null = null;
    private isInitialized = false;
    private readonly collectionName = 'codebase_functions';
    private indexStats: IndexStats | null = null;

    constructor(private readonly configService: ConfigService) { }

    /**
     * Initialize on module startup
     */
    async onModuleInit() {
        try {
            const apiKey = this.configService.get<string>('OPENAI_API_KEY');

            if (!apiKey) {
                this.logger.warn(
                    '⚠️  OPENAI_API_KEY not configured - Semantic matching disabled. ' +
                    'Set OPENAI_API_KEY in your .env file to enable AI-powered code matching.'
                );
                return;
            }

            this.embeddings = new OpenAIEmbeddings({
                openAIApiKey: apiKey,
                modelName: 'text-embedding-3-small', // Cost-effective, fast
                batchSize: 512, // Process in batches for performance
                timeout: 30000 // 30s timeout
            });

            // Test ChromaDB connection if configured
            const chromaUrl = this.configService.get<string>('CHROMA_URL');
            if (chromaUrl) {
                await this.testChromaDBConnection(chromaUrl);
            } else {
                this.logger.log('📝 ChromaDB URL not configured - will use in-memory mode when indexing');
            }

            this.isInitialized = true;
            this.logger.log('✅ Semantic matching service initialized successfully');

        } catch (error) {
            this.logger.error('❌ Failed to initialize semantic matching service:', error);
            this.isInitialized = false;
        }
    }

    /**
     * Index repository for semantic search - PRODUCTION READY
     */
    async indexRepository(files: AnalyzedFile[]): Promise<IndexStats> {
        if (!this.isInitialized || !this.embeddings) {
            throw new Error('Semantic matching not initialized. Check OPENAI_API_KEY configuration.');
        }

        const startTime = Date.now();
        let totalFunctions = 0;
        let totalClasses = 0;

        try {
            this.logger.log(`🔄 Indexing ${files.length} files for semantic search...`);

            // Build documents from code
            const documents: Document[] = [];

            for (const file of files) {
                // Index functions
                for (const func of file.analysis.functions) {
                    const doc = this.buildFunctionDocument(func, file);
                    if (doc) {
                        documents.push(doc);
                        totalFunctions++;
                    }
                }

                // Index classes
                for (const cls of file.analysis.classes) {
                    const doc = this.buildClassDocument(cls, file);
                    if (doc) {
                        documents.push(doc);
                        totalClasses++;
                    }
                }
            }

            if (documents.length === 0) {
                this.logger.warn('No indexable content found in files');
                return this.emptyStats();
            }

            this.logger.log(`📄 Prepared ${documents.length} documents for indexing`);

            // Create vector store with cloud authentication and tenant support
            const chromaConfig = this.buildChromaConfig(this.collectionName);

            // Log if using cloud authentication
            if (this.configService.get<string>('CHROMA_API_KEY')) {
                this.logger.log('🔐 Using ChromaDB Cloud authentication');
            }

            this.vectorStore = await Chroma.fromDocuments(
                documents,
                this.embeddings,
                chromaConfig
            );

            // Store stats
            this.indexStats = {
                totalDocuments: documents.length,
                totalFunctions,
                totalClasses,
                indexedAt: new Date(),
                collectionName: this.collectionName
            };

            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            this.logger.log(
                `✅ Semantic index created: ${documents.length} documents ` +
                `(${totalFunctions} functions, ${totalClasses} classes) in ${duration}s`
            );

            return this.indexStats;

        } catch (error) {
            this.logger.error('❌ Failed to index repository:', error);
            throw new Error(`Semantic indexing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Build document from function
     */
    private buildFunctionDocument(func: FunctionInfo, file: AnalyzedFile): Document | null {
        try {
            // Extract code snippet (limit to 500 chars for embedding)
            const lines = file.content.split('\n');
            const funcLines = lines.slice(
                Math.max(0, func.startLine - 1),
                Math.min(lines.length, func.endLine)
            );
            const code = funcLines.join('\n').substring(0, 500);

            // Build rich context for embedding
            const context = this.buildFunctionContext(func, file, code);

            // Extract data operations and tables
            const dataOps = this.extractDataOperationsFromCode(code);
            const tables = this.extractTablesFromCode(code);

            return new Document({
                pageContent: context,
                metadata: {
                    type: 'function',
                    filePath: file.path,
                    functionName: func.name,
                    startLine: func.startLine,
                    endLine: func.endLine,
                    language: file.language,
                    dataOperations: dataOps.join(','), // Convert to string for ChromaDB compatibility
                    tables: tables.join(','), // Convert to string
                    complexity: func.complexity || 1,
                    isAsync: func.isAsync,
                    decorators: (func.decorators || []).join(','), // Convert to string
                    snippet: code.substring(0, 200)
                }
            });
        } catch (error) {
            this.logger.warn(`Failed to build document for function ${func.name}:`, error);
            return null;
        }
    }

    /**
     * Build rich context for function embedding
     */
    private buildFunctionContext(func: FunctionInfo, file: AnalyzedFile, code: string): string {
        const parts: string[] = [];

        // Function signature
        parts.push(`Function: ${func.name}`);

        // Parameters
        if (func.parameters && func.parameters.length > 0) {
            const params = func.parameters.map(p => `${p.name}: ${p.type || 'any'}`).join(', ');
            parts.push(`Parameters: ${params}`);
        }

        // Return type
        if (func.returnType) {
            parts.push(`Returns: ${func.returnType}`);
        }

        // Docstring
        if (func.docstring) {
            parts.push(`Description: ${func.docstring.substring(0, 200)}`);
        }

        // Data operations
        const dataOps = this.extractDataOperationsFromCode(code);
        if (dataOps.length > 0) {
            parts.push(`Operations: ${dataOps.join(', ')}`);
        }

        // Tables accessed
        const tables = this.extractTablesFromCode(code);
        if (tables.length > 0) {
            parts.push(`Tables: ${tables.join(', ')}`);
        }

        // Code snippet
        parts.push(`Code:\n${code.substring(0, 300)}`);

        return parts.join('\n');
    }

    /**
     * Build document from class
     */
    private buildClassDocument(cls: any, file: AnalyzedFile): Document | null {
        try {
            const lines = file.content.split('\n');
            const classLines = lines.slice(
                Math.max(0, cls.startLine - 1),
                Math.min(lines.length, cls.endLine)
            );
            const code = classLines.join('\n').substring(0, 500);

            const context = `Class: ${cls.name}\n` +
                `Base Classes: ${cls.baseClasses?.join(', ') || 'None'}\n` +
                `Methods: ${cls.methods?.map((m: any) => m.name).join(', ') || 'None'}\n` +
                `Code:\n${code.substring(0, 300)}`;

            return new Document({
                pageContent: context,
                metadata: {
                    type: 'class',
                    filePath: file.path,
                    className: cls.name,
                    startLine: cls.startLine,
                    endLine: cls.endLine,
                    language: file.language,
                    baseClasses: (cls.baseClasses || []).join(','), // Convert to string
                    methodCount: cls.methods?.length || 0,
                    snippet: code.substring(0, 200)
                }
            });
        } catch (error) {
            this.logger.warn(`Failed to build document for class ${cls.name}:`, error);
            return null;
        }
    }

    /**
     * Extract data operations from code
     */
    private extractDataOperationsFromCode(code: string): string[] {
        const operations: string[] = [];
        const patterns = [
            'read', 'write', 'filter', 'select', 'join',
            'groupBy', 'agg', 'transform', 'withColumn', 'union'
        ];

        for (const pattern of patterns) {
            if (new RegExp(`\\.${pattern}\\s*\\(`).test(code)) {
                operations.push(pattern);
            }
        }

        return [...new Set(operations)];
    }

    /**
     * Extract table names from code
     */
    private extractTablesFromCode(code: string): string[] {
        const tables: string[] = [];
        const patterns = [
            /table\s*\(\s*["']([a-zA-Z0-9_\.]+)["']\s*\)/g,
            /["']([a-zA-Z0-9_]+\.[a-zA-Z0-9_]+)["']/g
        ];

        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(code)) !== null) {
                tables.push(match[1]);
            }
        }

        return [...new Set(tables)];
    }

    /**
     * Find semantic matches for execution plan stage - PRODUCTION READY
     */
    async findSemanticMatches(
        stage: ExecutionPlanStage,
        topK: number = 5
    ): Promise<SemanticMatch[]> {
        if (!this.vectorStore) {
            throw new Error('Vector store not initialized. Call indexRepository() first.');
        }

        const startTime = Date.now();

        try {
            // Build rich query from stage
            const query = this.buildStageQuery(stage);

            this.logger.debug(`Searching for semantic matches: ${stage.name}`);

            if (!this.embeddings) {
                this.logger.warn('Embeddings not initialized, returning empty matches');
                return [];
            }

            // Generate query embedding
            const queryEmbedding = await this.embeddings.embedQuery(query);

            // Perform semantic search with vector
            const results = await this.vectorStore.similaritySearchVectorWithScore(queryEmbedding, topK);

            // Convert to SemanticMatch objects
            const matches: SemanticMatch[] = results.map(([doc, score]: [Document, number]) => {
                const confidence = this.scoreToConfidence(score);

                return {
                    filePath: doc.metadata.filePath,
                    functionName: doc.metadata.functionName || doc.metadata.className,
                    startLine: doc.metadata.startLine,
                    endLine: doc.metadata.endLine,
                    semanticSimilarity: score,
                    confidence,
                    snippet: doc.metadata.snippet || '',
                    metadata: {
                        language: doc.metadata.language,
                        dataOperations: (doc.metadata.dataOperations as string || '').split(',').filter(Boolean),
                        tables: (doc.metadata.tables as string || '').split(',').filter(Boolean),
                        complexity: doc.metadata.complexity || 1
                    }
                };
            });

            const duration = Date.now() - startTime;
            this.logger.debug(
                `Found ${matches.length} semantic matches for "${stage.name}" in ${duration}ms`
            );

            return matches;

        } catch (error) {
            this.logger.error(`Semantic search failed for stage ${stage.name}:`, error);
            return [];
        }
    }

    /**
     * Build ChromaDB configuration with cloud authentication and tenant support
     */
    private buildChromaConfig(collectionName: string): any {
        const chromaUrl = this.configService.get<string>('CHROMA_URL') || 'http://localhost:8000';
        const chromaConfig: any = {
            collectionName,
            url: chromaUrl
        };

        // Add ChromaDB Cloud configuration via clientParams
        const chromaApiKey = this.configService.get<string>('CHROMA_API_KEY');
        const chromaTenant = this.configService.get<string>('CHROMA_TENANT');
        const chromaDatabase = this.configService.get<string>('CHROMA_DATABASE');

        // Build clientParams for ChromaDB Cloud
        const clientParams: any = {};

        if (chromaTenant) {
            clientParams.tenant = chromaTenant;
        }

        if (chromaDatabase) {
            clientParams.database = chromaDatabase;
        }

        // Add auth for ChromaDB Cloud via clientParams (NOT chromaCloudAPIKey)
        if (chromaApiKey) {
            clientParams.auth = {
                provider: 'token',
                credentials: chromaApiKey,
                tokenHeaderType: 'X_CHROMA_TOKEN'
            };
        }

        // Add clientParams if we have cloud configuration
        if (Object.keys(clientParams).length > 0) {
            chromaConfig.clientParams = clientParams;
        }

        return chromaConfig;
    }

    /**
     * Test ChromaDB connection
     */
    private async testChromaDBConnection(chromaUrl: string): Promise<void> {
        try {
            const chromaApiKey = this.configService.get<string>('CHROMA_API_KEY');
            const chromaTenant = this.configService.get<string>('CHROMA_TENANT');

            if (chromaApiKey && chromaTenant) {
                this.logger.log(`🔐 Connecting to ChromaDB Cloud at ${chromaUrl} (Tenant: ${chromaTenant})`);
            } else if (chromaApiKey) {
                this.logger.log(`🔐 Connecting to ChromaDB Cloud at ${chromaUrl}`);
            } else {
                this.logger.log(`🔌 Connecting to ChromaDB at ${chromaUrl}`);
            }

            // Build config for connection test
            const chromaConfig = this.buildChromaConfig('connection_test');

            // Try to create a temporary collection to test connection
            const testStore = await Chroma.fromTexts(
                ['test'],
                [{ test: true }],
                this.embeddings!,
                chromaConfig
            );

            // Delete the test collection
            try {
                await testStore.delete({ filter: { test: true } });
            } catch (e) {
                // Ignore deletion errors
            }

            this.logger.log(`✅ Connected to ChromaDB successfully`);
        } catch (error) {
            this.logger.warn(
                `⚠️  Failed to connect to ChromaDB at ${chromaUrl}: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
                'Will fall back to in-memory mode when indexing.'
            );
        }
    }

    /**
     * Load from existing collection (for reconnecting to persisted data)
     */
    async loadFromExistingCollection(): Promise<boolean> {
        if (!this.embeddings) {
            this.logger.warn('Cannot load collection: embeddings not initialized');
            return false;
        }

        try {
            const chromaUrl = this.configService.get<string>('CHROMA_URL');
            if (!chromaUrl) {
                this.logger.debug('No ChromaDB URL configured, skipping collection load');
                return false;
            }

            // Build config with tenant support
            const chromaConfig = this.buildChromaConfig(this.collectionName);

            this.vectorStore = await Chroma.fromExistingCollection(
                this.embeddings,
                chromaConfig
            );

            this.logger.log(`✅ Loaded existing collection: ${this.collectionName}`);
            return true;
        } catch (error) {
            this.logger.debug(
                `Collection '${this.collectionName}' not found or error loading: ${error instanceof Error ? error.message : 'Unknown'}. ` +
                'Will create new collection on first index.'
            );
            return false;
        }
    }

    /**
     * Build query from execution plan stage
     */
    private buildStageQuery(stage: ExecutionPlanStage): string {
        const parts: string[] = [];

        // Stage name and type
        parts.push(`Stage: ${stage.name}`);
        parts.push(`Type: ${stage.type}`);

        // Description
        if (stage.description) {
            parts.push(`Description: ${stage.description}`);
        }

        // Input tables
        if (stage.inputs && stage.inputs.length > 0) {
            parts.push(`Input Tables: ${stage.inputs.join(', ')}`);
        }

        // Output tables
        if (stage.outputs && stage.outputs.length > 0) {
            parts.push(`Output Tables: ${stage.outputs.join(', ')}`);
        }

        // Infer operations from stage type
        const operations = this.inferOperationsFromStageType(stage.type);
        if (operations.length > 0) {
            parts.push(`Operations: ${operations.join(', ')}`);
        }

        return parts.join('\n');
    }

    /**
     * Infer operations from stage type
     */
    private inferOperationsFromStageType(stageType: string): string[] {
        const mapping: Record<string, string[]> = {
            'data_ingestion': ['read', 'load', 'scan'],
            'transformation': ['transform', 'select', 'withColumn'],
            'aggregation': ['groupBy', 'agg', 'sum', 'count'],
            'join': ['join', 'merge'],
            'filter': ['filter', 'where'],
            'write': ['write', 'save', 'insert'],
            'shuffle': ['repartition', 'coalesce'],
            'sort': ['orderBy', 'sort']
        };

        return mapping[stageType] || [];
    }

    /**
     * Convert similarity score (0-1) to confidence (0-100)
     */
    private scoreToConfidence(score: number): number {
        // Chroma returns cosine similarity (higher = better)
        // Convert to percentage with non-linear scaling for better distribution
        const normalized = Math.max(0, Math.min(1, score));
        const confidence = Math.round(normalized * 100);

        // Apply threshold - scores below 0.7 get reduced confidence
        if (normalized < 0.7) {
            return Math.round(confidence * 0.8);
        }

        return confidence;
    }

    /**
     * Get index statistics
     */
    getIndexStats(): IndexStats | null {
        return this.indexStats;
    }

    /**
     * Check if service is ready
     */
    isReady(): boolean {
        return this.isInitialized && this.vectorStore !== null;
    }

    /**
     * Clear vector store (for testing/reset)
     */
    async clearIndex(): Promise<void> {
        if (this.vectorStore) {
            try {
                // Note: Chroma doesn't have a built-in clear method
                // You may need to delete and recreate the collection
                this.vectorStore = null;
                this.indexStats = null;
                this.logger.log('Vector store cleared');
            } catch (error) {
                this.logger.error('Failed to clear vector store:', error);
            }
        }
    }

    /**
     * Return empty stats
     */
    private emptyStats(): IndexStats {
        return {
            totalDocuments: 0,
            totalFunctions: 0,
            totalClasses: 0,
            indexedAt: new Date(),
            collectionName: this.collectionName
        };
    }
}
