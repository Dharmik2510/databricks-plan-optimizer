import { WorkflowLoggerService } from '../logging/workflow-logger.service';

/**
 * Decorator options for workflow node logging
 */
export interface WorkflowNodeOptions {
  /**
   * Human-readable node name (e.g., "Analyze Query Plan")
   */
  nodeName: string;

  /**
   * Node type category (e.g., "agent", "tool", "llm", "decision")
   */
  nodeType: string;

  /**
   * Whether to log input data (default: true)
   */
  logInput?: boolean;

  /**
   * Whether to log output data (default: true)
   */
  logOutput?: boolean;

  /**
   * Custom input transformer to redact sensitive data
   */
  inputTransformer?: (input: any) => any;

  /**
   * Custom output transformer to redact sensitive data
   */
  outputTransformer?: (output: any) => any;
}

/**
 * Method decorator for automatic workflow node logging
 *
 * Usage:
 * ```typescript
 * class MyWorkflow {
 *   constructor(private workflowLogger: WorkflowLoggerService) {}
 *
 *   @WorkflowNode({
 *     nodeName: 'Analyze Query Plan',
 *     nodeType: 'agent',
 *   })
 *   async analyzeQueryPlan(state: WorkflowState): Promise<WorkflowState> {
 *     // Your node logic here
 *     return state;
 *   }
 * }
 * ```
 *
 * IMPORTANT: The decorated method must be in a class that has a `workflowLogger: WorkflowLoggerService`
 * property and the workflow state must have a `workflowRunId` property.
 */
export function WorkflowNode(options: WorkflowNodeOptions) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (this: any, ...args: any[]) {
      const workflowLogger: WorkflowLoggerService | undefined = this.workflowLogger;

      // If workflowLogger is not available, just run the method without logging
      if (!workflowLogger) {
        console.warn(
          `WorkflowNode decorator on ${propertyKey}: workflowLogger not found. Skipping logging.`,
        );
        return originalMethod.apply(this, args);
      }

      // Extract workflowRunId from state (first argument for LangGraph nodes)
      const state = args[0];
      const workflowRunId = state?.workflowRunId;

      if (!workflowRunId) {
        console.warn(
          `WorkflowNode decorator on ${propertyKey}: workflowRunId not found in state. Skipping logging.`,
        );
        return originalMethod.apply(this, args);
      }

      // Generate unique node ID from method name and timestamp
      const nodeId = `${propertyKey}_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      // Prepare input for logging
      const logInput = options.logInput !== false;
      let inputToLog = logInput ? state : undefined;
      if (inputToLog && options.inputTransformer) {
        inputToLog = options.inputTransformer(inputToLog);
      }

      // Start node tracking
      const startTime = await workflowLogger.logNodeStart(
        workflowRunId,
        nodeId,
        options.nodeName,
        options.nodeType,
        inputToLog,
      );

      try {
        // Execute original method
        const result = await originalMethod.apply(this, args);

        // Prepare output for logging
        const logOutput = options.logOutput !== false;
        let outputToLog = logOutput ? result : undefined;
        if (outputToLog && options.outputTransformer) {
          outputToLog = options.outputTransformer(outputToLog);
        }

        // Log completion
        await workflowLogger.logNodeComplete(
          workflowRunId,
          nodeId,
          options.nodeName,
          options.nodeType,
          outputToLog,
          startTime,
        );

        return result;
      } catch (error) {
        // Log error
        await workflowLogger.logNodeError(
          workflowRunId,
          nodeId,
          options.nodeName,
          options.nodeType,
          error as Error,
          startTime,
        );

        // Re-throw to preserve error handling
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Helper function to manually log a workflow node (for cases where decorator can't be used)
 *
 * Usage:
 * ```typescript
 * await logWorkflowNode(
 *   workflowLogger,
 *   workflowRunId,
 *   'process-results',
 *   'Process Results',
 *   'processing',
 *   async () => {
 *     // Your node logic here
 *     return result;
 *   }
 * );
 * ```
 */
export async function logWorkflowNode<T>(
  workflowLogger: WorkflowLoggerService,
  workflowRunId: string,
  nodeId: string,
  nodeName: string,
  nodeType: string,
  fn: () => Promise<T>,
  input?: any,
): Promise<T> {
  return workflowLogger.withNodeTracking(
    workflowRunId,
    nodeId,
    nodeName,
    nodeType,
    fn,
    input,
  );
}

/**
 * Common input/output transformers for sensitive data redaction
 */
export const WorkflowTransformers = {
  /**
   * Redact API keys and tokens from input/output
   */
  redactSecrets: (data: any): any => {
    if (!data || typeof data !== 'object') return data;

    const redacted = Array.isArray(data) ? [...data] : { ...data };

    const sensitiveKeys = [
      'apiKey',
      'api_key',
      'token',
      'secret',
      'password',
      'authorization',
      'bearer',
      'jwt',
      'credentials',
    ];

    for (const key in redacted) {
      if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
        redacted[key] = '[REDACTED]';
      } else if (typeof redacted[key] === 'object' && redacted[key] !== null) {
        redacted[key] = WorkflowTransformers.redactSecrets(redacted[key]);
      }
    }

    return redacted;
  },

  /**
   * Keep only specific fields from state (useful for large state objects)
   */
  keepFields: (fields: string[]) => (data: any): any => {
    if (!data || typeof data !== 'object') return data;

    const result: any = {};
    for (const field of fields) {
      if (data[field] !== undefined) {
        result[field] = data[field];
      }
    }
    return result;
  },

  /**
   * Omit specific fields from state
   */
  omitFields: (fields: string[]) => (data: any): any => {
    if (!data || typeof data !== 'object') return data;

    const result = Array.isArray(data) ? [...data] : { ...data };
    for (const field of fields) {
      delete result[field];
    }
    return result;
  },

  /**
   * Truncate large string/array fields
   */
  truncateLarge: (maxLength = 1000) => (data: any): any => {
    if (!data || typeof data !== 'object') return data;

    const truncated = Array.isArray(data) ? [...data] : { ...data };

    for (const key in truncated) {
      if (typeof truncated[key] === 'string' && truncated[key].length > maxLength) {
        truncated[key] = truncated[key].substring(0, maxLength) + '... [truncated]';
      } else if (Array.isArray(truncated[key]) && truncated[key].length > 100) {
        truncated[key] = [...truncated[key].slice(0, 100), `... [${truncated[key].length - 100} more items]`];
      } else if (typeof truncated[key] === 'object' && truncated[key] !== null) {
        truncated[key] = WorkflowTransformers.truncateLarge(maxLength)(truncated[key]);
      }
    }

    return truncated;
  },
};
