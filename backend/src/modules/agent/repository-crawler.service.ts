import { AnalyzedFile, RepositoryConfig, FileAnalysis, DataOperation, FunctionInfo, AgentLog, SupportedLanguage, ClassInfo, ImportInfo, TableReference } from './agent-types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import simpleGit from 'simple-git';
import { v4 as uuidv4 } from 'uuid';

export class RepositoryCrawlerService {
    constructor(private onLog?: (log: AgentLog) => void) { }

    async crawlRepository(config: RepositoryConfig): Promise<AnalyzedFile[]> {
        const tempDir = path.join(os.tmpdir(), `repo-${uuidv4()}`);

        try {
            this.log('info', `Cloning ${config.url} (branch: ${config.branch}) to temp directory...`);
            await fs.promises.mkdir(tempDir, { recursive: true });

            const git = simpleGit();
            await git.clone(config.url, tempDir, ['--depth', '1', '--branch', config.branch]);

            return await this.scanDirectory(tempDir, config, tempDir);
        } catch (e: any) {
            this.log('error', `Failed to crawl repository: ${e.message}`);
            throw e;
        } finally {
            // Cleanup in background to speed up response
            fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => { });
        }
    }

    private async scanDirectory(currentPath: string, config: RepositoryConfig, rootPath: string): Promise<AnalyzedFile[]> {
        const files: AnalyzedFile[] = [];
        const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(currentPath, entry.name);
            const relativePath = path.relative(rootPath, fullPath);

            if (entry.isDirectory()) {
                if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
                files.push(...await this.scanDirectory(fullPath, config, rootPath));
            } else {
                if (this.shouldIncludeFile(entry.name, config)) {
                    const content = await fs.promises.readFile(fullPath, 'utf-8');
                    const language = this.detectLanguage(entry.name);
                    const stats = await fs.promises.stat(fullPath);

                    files.push({
                        path: relativePath,
                        content,
                        language,
                        size: stats.size,
                        lastModified: stats.mtime,
                        analysis: this.analyzeFile(content, language)
                    });
                }
            }
        }
        return files;
    }

    private shouldIncludeFile(filename: string, config: RepositoryConfig): boolean {
        const basename = path.basename(filename).toLowerCase();
        if (['package.json', 'package-lock.json', 'yarn.lock', 'tsconfig.json', 'requirements.txt', 'pom.xml', 'build.gradle'].includes(basename)) {
            return false;
        }
        const ext = path.extname(filename).toLowerCase();
        const validExts = ['.py', '.scala', '.sql', '.java', '.yaml', '.yml', '.json', '.ipynb'];
        return validExts.includes(ext);
    }

    private detectLanguage(filename: string): SupportedLanguage {
        const ext = path.extname(filename).toLowerCase();
        if (ext === '.py') return 'python';
        if (ext === '.scala') return 'scala';
        if (ext === '.sql') return 'sql';
        if (ext === '.java') return 'java';
        if (ext === '.yaml' || ext === '.yml') return 'yaml';
        if (ext === '.json') return 'json';
        if (ext === '.ipynb') return 'notebook';
        return 'unknown';
    }

    private analyzeFile(content: string, language: SupportedLanguage): FileAnalysis {
        // Regex-based analysis
        return {
            functions: this.extractFunctions(content, language),
            classes: this.extractClasses(content, language),
            imports: this.extractImports(content, language),
            dataOperations: this.extractDataOperations(content, language),
            tableReferences: this.extractTableReferences(content, language),
            configReferences: [],
            annotations: [],
            complexity: {
                cyclomaticComplexity: 0,
                linesOfCode: content.split('\n').length,
                cognitiveComplexity: 0
            }
        };
    }

    private extractFunctions(content: string, language: SupportedLanguage): FunctionInfo[] {
        const functions: FunctionInfo[] = [];
        const lines = content.split('\n');
        let regex = /function\s+([a-zA-Z0-9_]+)/; // default

        if (language === 'python') regex = /def\s+([a-zA-Z0-9_]+)\s*\(/;
        if (language === 'scala' || language === 'java') regex = /def\s+([a-zA-Z0-9_]+)\s*\(/; // Scala often uses def

        lines.forEach((line, i) => {
            const match = line.match(regex);
            if (match) {
                functions.push({
                    name: match[1],
                    startLine: i + 1,
                    endLine: i + 5, // Approximate
                    parameters: [],
                    calls: [],
                    isAsync: line.includes('async'),
                    complexity: 1
                });
            }
        });
        return functions;
    }

    private extractClasses(content: string, language: SupportedLanguage): ClassInfo[] {
        const classes: ClassInfo[] = [];
        const lines = content.split('\n');
        const regex = /class\s+([a-zA-Z0-9_]+)/;

        lines.forEach((line, i) => {
            const match = line.match(regex);
            if (match) {
                classes.push({
                    name: match[1],
                    startLine: i + 1,
                    endLine: i + 10, // Approximate
                    baseClasses: [],
                    methods: [],
                    attributes: []
                });
            }
        });
        return classes;
    }

    private extractImports(content: string, language: SupportedLanguage): ImportInfo[] {
        const imports: ImportInfo[] = [];
        const lines = content.split('\n');

        lines.forEach((line, i) => {
            if (language === 'python') {
                if (line.startsWith('import ') || line.startsWith('from ')) {
                    imports.push({ module: line.trim(), items: [], line: i + 1, isRelative: line.includes('.') });
                }
            } else {
                if (line.startsWith('import ')) {
                    imports.push({ module: line.replace('import ', '').replace(';', '').trim(), items: [], line: i + 1, isRelative: false });
                }
            }
        });
        return imports;
    }

    private extractDataOperations(content: string, language: SupportedLanguage): DataOperation[] {
        const ops: DataOperation[] = [];
        const lines = content.split('\n');

        // Keywords for data operations
        const keywords: Record<string, string[]> = {
            'read': ['read', 'load', 'scan'],
            'write': ['write', 'save', 'insert'],
            'join': ['join', 'merge'],
            'filter': ['filter', 'where'],
            'aggregate': ['groupBy', 'agg', 'sum', 'count', 'avg'],
            'transform': ['select', 'withColumn', 'map', 'flatMap']
        };

        lines.forEach((line, i) => {
            const lower = line.toLowerCase();
            for (const [type, keys] of Object.entries(keywords)) {
                if (keys.some(k => lower.includes(k))) {
                    ops.push({
                        type: type as any,
                        line: i + 1,
                        code: line.trim(),
                        confidence: 0.8
                    });
                    break; // Count as one op per line
                }
            }
        });
        return ops;
    }

    private extractTableReferences(content: string, language: SupportedLanguage): TableReference[] {
        const tables: TableReference[] = [];
        const lines = content.split('\n');

        // Match table patterns like "database.table", "FROM table", "table("name")"
        const patterns = [
            /(?:FROM|JOIN)\s+([a-zA-Z0-9_]+\.[a-zA-Z0-9_]+)/i,
            /(?:read|table)\s*\(\s*["']([a-zA-Z0-9_]+\.[a-zA-Z0-9_]+)["']\s*\)/i,
            /(?:parquet|csv|json)\s*\(\s*["']([^"']+)["']\s*\)/i // File paths
        ];

        lines.forEach((line, i) => {
            for (const pattern of patterns) {
                const match = line.match(pattern);
                if (match) {
                    tables.push({
                        name: match[1],
                        operation: line.toLowerCase().includes('write') ? 'write' : 'read',
                        line: i + 1
                    });
                }
            }
        });
        return tables;
    }

    private log(level: AgentLog['level'], message: string) {
        if (this.onLog) {
            this.onLog({ timestamp: new Date(), level, message });
        }
    }
}
