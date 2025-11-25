
import { RepoConfig, RepoFile, CodeSnippet, DagNode, EnhancedCodeSnippet, CodeContext, FunctionDefinition, ImportStatement, TableReference, SparkOperation, DependencyInfo } from "../types";

export class CodeAnalysisEngine {
  private contexts: Map<string, CodeContext> = new Map();
  private globalFunctionMap: Map<string, { file: string; line: number }> = new Map();
  private tableToFileMap: Map<string, string[]> = new Map();

  constructor(private files: RepoFile[]) {
    this.analyzeAllFiles();
    this.buildGlobalMaps();
  }

  private analyzeAllFiles() {
    for (const file of this.files) {
      const context = this.analyzeFile(file);
      this.contexts.set(file.path, context);
    }
  }

  private analyzeFile(file: RepoFile): CodeContext {
    const extension = file.path.split('.').pop();
    
    switch (extension) {
      case 'py':
        return this.analyzePython(file);
      case 'scala':
        return this.analyzeScala(file);
      case 'sql':
        return this.analyzeSQL(file);
      case 'ipynb':
        return this.analyzeNotebook(file);
      default:
        return this.createEmptyContext(file);
    }
  }

  private analyzePython(file: RepoFile): CodeContext {
    const lines = file.content.split('\n');
    const context: CodeContext = {
      file,
      functions: [],
      imports: [],
      tableReferences: [],
      sparkOperations: []
    };

    let currentFunction: FunctionDefinition | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Parse imports
      if (trimmed.startsWith('import ') || trimmed.startsWith('from ')) {
        context.imports.push(this.parseImport(trimmed, i + 1));
      }

      // Parse function definitions
      if (trimmed.startsWith('def ')) {
        if (currentFunction) {
          currentFunction.endLine = i;
          context.functions.push(currentFunction);
        }
        currentFunction = this.parseFunctionDef(trimmed, i + 1);
      }

      // Parse Spark operations
      const sparkOp = this.detectSparkOperation(trimmed, i + 1);
      if (sparkOp) {
        context.sparkOperations.push(sparkOp);
        if (currentFunction) {
          currentFunction.calls.push(sparkOp.type);
        }
      }

      // Parse table references
      const tableRef = this.detectTableReference(trimmed, i + 1);
      if (tableRef) {
        context.tableReferences.push(tableRef);
      }

      // Detect dataframe operations
      if (currentFunction && this.isDataframeOperation(trimmed)) {
        const dfName = this.extractDataframeName(trimmed);
        if (dfName && !currentFunction.usesDataframes.includes(dfName)) {
          currentFunction.usesDataframes.push(dfName);
        }
      }
    }

    // Close last function
    if (currentFunction) {
      currentFunction.endLine = lines.length;
      context.functions.push(currentFunction);
    }

    return context;
  }

  private analyzeScala(file: RepoFile): CodeContext {
    // Similar to Python but adapted for Scala syntax
    const lines = file.content.split('\n');
    const context: CodeContext = {
      file,
      functions: [],
      imports: [],
      tableReferences: [],
      sparkOperations: []
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Scala imports
      if (line.startsWith('import ')) {
        context.imports.push({
          module: line.replace('import ', '').replace(';', '').trim(),
          items: [],
          line: i + 1
        });
      }

      // Detect Spark operations
      if (line.includes('.read') || line.includes('.write') || line.includes('.join')) {
        const sparkOp = this.detectSparkOperation(line, i + 1);
        if (sparkOp) context.sparkOperations.push(sparkOp);
      }

      // Table references
      const tableRef = this.detectTableReference(line, i + 1);
      if (tableRef) context.tableReferences.push(tableRef);
    }

    return context;
  }

  private analyzeSQL(file: RepoFile): CodeContext {
    const context: CodeContext = {
      file,
      functions: [],
      imports: [],
      tableReferences: [],
      sparkOperations: []
    };

    const lines = file.content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim().toLowerCase();
      
      // Detect table operations
      if (line.includes('from ') || line.includes('join ')) {
        const tables = this.extractSQLTables(line);
        tables.forEach(table => {
          context.tableReferences.push({
            name: table,
            operation: line.includes('join') ? 'join' : 'read',
            line: i + 1,
            context: lines[i]
          });
        });
      }
    }

    return context;
  }

  private analyzeNotebook(file: RepoFile): CodeContext {
    // Parse Jupyter notebooks
    try {
      const notebook = JSON.parse(file.content);
      const codeContent = notebook.cells
        ?.filter((cell: any) => cell.cell_type === 'code')
        ?.map((cell: any) => cell.source.join('\n'))
        ?.join('\n\n') || '';

      return this.analyzePython({
        ...file,
        content: codeContent
      });
    } catch (error) {
      return this.createEmptyContext(file);
    }
  }

  private buildGlobalMaps() {
    // Build function name → file mapping
    for (const [filePath, context] of this.contexts) {
      context.functions.forEach(func => {
        this.globalFunctionMap.set(func.name, {
          file: filePath,
          line: func.startLine
        });
      });

      // Build table → files mapping
      context.tableReferences.forEach(ref => {
        const files = this.tableToFileMap.get(ref.name) || [];
        if (!files.includes(filePath)) {
          files.push(filePath);
          this.tableToFileMap.set(ref.name, files);
        }
      });
    }
  }

  // ============================================
  // DAG NODE TO CODE MAPPING
  // ============================================

  public mapDagNodesToCode(dagNodes: DagNode[]): EnhancedCodeSnippet[] {
    const mappings: EnhancedCodeSnippet[] = [];

    for (const node of dagNodes) {
      const nodeMappings = this.mapSingleNode(node);
      mappings.push(...nodeMappings);
    }

    // Sort by confidence score
    return mappings.sort((a, b) => b.confidence - a.confidence);
  }

  private mapSingleNode(node: DagNode): EnhancedCodeSnippet[] {
    const mappings: EnhancedCodeSnippet[] = [];

    // Strategy 1: Table name matching (FileScan nodes)
    if (node.type.toLowerCase().includes('scan') || node.type.toLowerCase().includes('filescan')) {
      mappings.push(...this.mapByTableName(node));
    }

    // Strategy 2: Join operation matching
    if (node.type.toLowerCase().includes('join')) {
      mappings.push(...this.mapByJoinPattern(node));
    }

    // Strategy 3: Aggregate/GroupBy matching
    if (node.type.toLowerCase().includes('aggregate') || node.type.toLowerCase().includes('group')) {
      mappings.push(...this.mapByAggregatePattern(node));
    }

    // Strategy 4: Exchange/Shuffle matching
    if (node.type.toLowerCase().includes('exchange') || node.type.toLowerCase().includes('shuffle')) {
      mappings.push(...this.mapByShufflePattern(node));
    }

    return mappings;
  }

  private mapByTableName(node: DagNode): EnhancedCodeSnippet[] {
    const mappings: EnhancedCodeSnippet[] = [];
    
    // Extract table name from node (e.g., "FileScan parquet db.transactions")
    const tableName = this.extractTableFromNode(node);
    if (!tableName) return mappings;

    const relatedFiles = this.tableToFileMap.get(tableName) || [];

    for (const filePath of relatedFiles) {
      const context = this.contexts.get(filePath);
      if (!context) continue;

      // Find specific table references
      const refs = context.tableReferences.filter(ref => 
        ref.name.toLowerCase().includes(tableName.toLowerCase()) ||
        tableName.toLowerCase().includes(ref.name.toLowerCase())
      );

      for (const ref of refs) {
        const snippet = this.createSnippet(context, ref.line, node, 'exact', 95);
        if (snippet) {
          snippet.dependencies = this.extractDependencies(context, ref.line);
          mappings.push(snippet);
        }
      }
    }

    return mappings;
  }

  private mapByJoinPattern(node: DagNode): EnhancedCodeSnippet[] {
    const mappings: EnhancedCodeSnippet[] = [];

    for (const [filePath, context] of this.contexts) {
      const joinOps = context.sparkOperations.filter(op => op.type === 'join');

      for (const op of joinOps) {
        // Check if this join matches the node characteristics
        const confidence = this.calculateJoinMatchConfidence(node, op, context);
        
        if (confidence > 50) {
          const snippet = this.createSnippet(context, op.line, node, 'partial', confidence);
          if (snippet) {
            snippet.callStack = this.traceCallStack(context, op.line);
            snippet.dependencies = this.extractDependencies(context, op.line);
            mappings.push(snippet);
          }
        }
      }
    }

    return mappings;
  }

  private mapByAggregatePattern(node: DagNode): EnhancedCodeSnippet[] {
    const mappings: EnhancedCodeSnippet[] = [];

    for (const [filePath, context] of this.contexts) {
      const aggOps = context.sparkOperations.filter(op => op.type === 'aggregate');

      for (const op of aggOps) {
        const confidence = this.calculateAggregateMatchConfidence(node, op);
        
        if (confidence > 50) {
          const snippet = this.createSnippet(context, op.line, node, 'partial', confidence);
          if (snippet) mappings.push(snippet);
        }
      }
    }

    return mappings;
  }

  private mapByShufflePattern(node: DagNode): EnhancedCodeSnippet[] {
    const mappings: EnhancedCodeSnippet[] = [];

    // Shuffles are often caused by joins, groupBy, or repartition
    for (const [filePath, context] of this.contexts) {
      const shuffleCausers = context.sparkOperations.filter(op => 
        ['join', 'aggregate', 'transform'].includes(op.type) &&
        (op.code.includes('groupBy') || op.code.includes('repartition') || op.code.includes('join'))
      );

      for (const op of shuffleCausers) {
        const snippet = this.createSnippet(context, op.line, node, 'inferred', 60);
        if (snippet) {
          snippet.relevanceExplanation = `This ${op.type} operation likely triggers the shuffle seen in ${node.name}`;
          mappings.push(snippet);
        }
      }
    }

    return mappings;
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private createSnippet(
    context: CodeContext,
    line: number,
    node: DagNode,
    matchType: 'exact' | 'partial' | 'inferred',
    confidence: number
  ): EnhancedCodeSnippet | null {
    const lines = context.file.content.split('\n');
    const startLine = Math.max(0, line - 3);
    const endLine = Math.min(lines.length, line + 3);
    const code = lines.slice(startLine, endLine).join('\n');

    return {
      filePath: context.file.path,
      lineNumber: line,
      code,
      relevanceExplanation: this.generateExplanation(node, matchType, context, line),
      confidence,
      matchType,
      callStack: this.traceCallStack(context, line),
      dependencies: this.extractDependencies(context, line)
    };
  }

  private extractDependencies(context: CodeContext, line: number): DependencyInfo[] {
    const deps: DependencyInfo[] = [];

    // Add imports used around this line
    context.imports.forEach(imp => {
      if (Math.abs(imp.line - line) < 20) {
        deps.push({
          type: this.isExternalLibrary(imp.module) ? 'external' : 'internal',
          source: imp.module,
          importedAs: imp.alias,
          usedFunctions: imp.items
        });
      }
    });

    return deps;
  }

  private traceCallStack(context: CodeContext, line: number): string[] {
    const stack: string[] = [];

    // Find which function contains this line
    const containingFunc = context.functions.find(f => 
      line >= f.startLine && line <= f.endLine
    );

    if (containingFunc) {
      stack.push(containingFunc.name);
      
      // Find functions that call this function
      for (const func of context.functions) {
        if (func.calls.includes(containingFunc.name)) {
          stack.unshift(func.name);
        }
      }
    }

    return stack;
  }

  private calculateJoinMatchConfidence(node: DagNode, op: SparkOperation, context: CodeContext): number {
    let confidence = 50; // Base confidence for any join

    // Check node type match
    const nodeType = node.type.toLowerCase();
    if (nodeType.includes('broadcast') && op.code.toLowerCase().includes('broadcast')) {
      confidence += 30;
    }

    // Check if nested loop join
    if (nodeType.includes('nestedloop') && !op.code.includes('==')) {
      confidence += 20; // Missing join condition
    }

    return Math.min(confidence, 100);
  }

  private calculateAggregateMatchConfidence(node: DagNode, op: SparkOperation): number {
    let confidence = 50;

    if (op.code.includes('groupBy')) confidence += 20;
    if (op.code.includes('agg(')) confidence += 15;
    if (node.name.toLowerCase().includes('sort') && op.code.includes('orderBy')) confidence += 15;

    return Math.min(confidence, 100);
  }

  private generateExplanation(node: DagNode, matchType: string, context: CodeContext, line: number): string {
    const funcContext = context.functions.find(f => line >= f.startLine && line <= f.endLine);
    const funcName = funcContext ? `in function '${funcContext.name}'` : '';

    switch (matchType) {
      case 'exact':
        return `Exact match: This code directly corresponds to the ${node.type} operation ${funcName}`;
      case 'partial':
        return `Likely match: This code appears to trigger the ${node.type} operation ${funcName}`;
      case 'inferred':
        return `Inferred: This code may be related to the ${node.type} operation ${funcName}`;
      default:
        return `Mapped to ${node.name} ${funcName}`;
    }
  }

  // ============================================
  // PARSING UTILITIES
  // ============================================

  private parseImport(line: string, lineNum: number): ImportStatement {
    if (line.startsWith('from ')) {
      const match = line.match(/from\s+(\S+)\s+import\s+(.+)/);
      if (match) {
        const items = match[2].split(',').map(s => s.trim().split(' as ')[0]);
        const alias = match[2].includes(' as ') ? match[2].split(' as ')[1].trim() : undefined;
        return { module: match[1], items, alias, line: lineNum };
      }
    } else {
      const match = line.match(/import\s+(.+?)(?:\s+as\s+(.+))?$/);
      if (match) {
        return { module: match[1], items: [], alias: match[2], line: lineNum };
      }
    }
    return { module: '', items: [], line: lineNum };
  }

  private parseFunctionDef(line: string, lineNum: number): FunctionDefinition {
    const match = line.match(/def\s+(\w+)\s*\((.*?)\)/);
    const name = match?.[1] || 'unknown';
    const params = match?.[2]?.split(',').map(p => p.trim().split(':')[0]) || [];

    return {
      name,
      startLine: lineNum,
      endLine: lineNum,
      parameters: params,
      calls: [],
      usesDataframes: []
    };
  }

  private detectSparkOperation(line: string, lineNum: number): SparkOperation | null {
    const lower = line.toLowerCase();
    
    if (lower.includes('.read.')) {
      return { type: 'read', line: lineNum, code: line, dataframes: [] };
    }
    if (lower.includes('.write.')) {
      return { type: 'write', line: lineNum, code: line, dataframes: [] };
    }
    if (lower.includes('.join(')) {
      return { type: 'join', line: lineNum, code: line, dataframes: this.extractDataframesFromJoin(line) };
    }
    if (lower.includes('.filter(') || lower.includes('.where(')) {
      return { type: 'filter', line: lineNum, code: line, dataframes: [] };
    }
    if (lower.includes('.groupby(') || lower.includes('.agg(')) {
      return { type: 'aggregate', line: lineNum, code: line, dataframes: [] };
    }
    if (lower.includes('.select(') || lower.includes('.withcolumn(')) {
      return { type: 'transform', line: lineNum, code: line, dataframes: [] };
    }

    return null;
  }

  private detectTableReference(line: string, lineNum: number): TableReference | null {
    // Pattern: spark.read.table("table_name") or .parquet("path/table")
    const patterns = [
      /\.table\(['"](\w+)['"]\)/,
      /\.parquet\(['"].*\/(\w+)['"]\)/,
      /\.csv\(['"].*\/(\w+)['"]\)/,
      /from\s+(\w+)/i
    ];

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        return {
          name: match[1],
          operation: 'read',
          line: lineNum,
          context: line
        };
      }
    }

    return null;
  }

  private extractTableFromNode(node: DagNode): string | null {
    // Extract from patterns like: "FileScan parquet db.transactions"
    const match = node.name.match(/(?:FileScan|Scan)\s+\w+\s+(?:\w+\.)?(\w+)/i);
    return match?.[1] || null;
  }

  private extractDataframesFromJoin(line: string): string[] {
    const matches = line.match(/(\w+)\.join\(/g);
    return matches ? matches.map(m => m.replace('.join(', '')) : [];
  }

  private extractDataframeName(line: string): string | null {
    const match = line.match(/(\w+)\s*=.*?(?:spark|df)\./);
    return match?.[1] || null;
  }

  private isDataframeOperation(line: string): boolean {
    const dfOps = ['.select', '.filter', '.join', '.groupBy', '.agg', '.withColumn'];
    return dfOps.some(op => line.includes(op));
  }

  private extractSQLTables(line: string): string[] {
    const tables: string[] = [];
    const fromMatch = line.match(/from\s+(\w+)/);
    if (fromMatch) tables.push(fromMatch[1]);
    
    const joinMatches = line.matchAll(/join\s+(\w+)/g);
    for (const match of joinMatches) {
      tables.push(match[1]);
    }
    
    return tables;
  }

  private isExternalLibrary(module: string): boolean {
    const externalLibs = ['pyspark', 'pandas', 'numpy', 'databricks', 'delta'];
    return externalLibs.some(lib => module.toLowerCase().startsWith(lib));
  }

  private createEmptyContext(file: RepoFile): CodeContext {
    return {
      file,
      functions: [],
      imports: [],
      tableReferences: [],
      sparkOperations: []
    };
  }
}

export default CodeAnalysisEngine;
