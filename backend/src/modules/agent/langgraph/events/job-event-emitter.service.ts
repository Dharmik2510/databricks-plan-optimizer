/**
 * Job Event Emitter Service (Singleton)
 * 
 * Centralized event bus for emitting job progress events to SSE clients.
 * Uses Node.js EventEmitter pattern with typed events.
 * 
 * Usage:
 *   const emitter = JobEventEmitterService.getInstance();
 *   emitter.emit('job:123', createStageStartedEvent({ ... }));
 *   emitter.on('job:123', (event) => { ... });
 * 
 * @see design_summary.md Section 6: Backend Event Model
 */

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'events';
import { AgentEvent } from './agent-event.types';

@Injectable()
export class JobEventEmitterService extends EventEmitter {
    private static instance: JobEventEmitterService;
    private readonly logger = new Logger(JobEventEmitterService.name);

    private constructor() {
        super();
        this.setMaxListeners(100); // Allow many concurrent job listeners
        this.logger.log('✅ JobEventEmitterService initialized (singleton)');
    }

    /**
     * Get singleton instance
     */
    static getInstance(): JobEventEmitterService {
        if (!JobEventEmitterService.instance) {
            JobEventEmitterService.instance = new JobEventEmitterService();
        }
        return JobEventEmitterService.instance;
    }

    /**
     * Emit event for a specific job
     * 
     * Events are namespaced by jobId: "job:{jobId}"
     * 
     * @param jobId - Job identifier
     * @param event - AgentEvent to emit
     */
    emitJobEvent(jobId: string, event: AgentEvent): void {
        const eventName = `job:${jobId}`;

        this.logger.debug(
            `Emitting ${event.type} for job ${jobId}`,
            event.data
        );

        this.emit(eventName, event);
    }

    /**
     * Subscribe to events for a specific job
     * 
     * @param jobId - Job identifier
     * @param handler - Event handler function
     * @returns Unsubscribe function
     */
    onJobEvent(jobId: string, handler: (event: AgentEvent) => void): () => void {
        const eventName = `job:${jobId}`;
        this.on(eventName, handler);

        // Return unsubscribe function
        return () => {
            this.off(eventName, handler);
        };
    }

    /**
     * Remove all listeners for a specific job
     * 
     * Call this when a job completes or client disconnects
     * 
     * @param jobId - Job identifier
     */
    removeJobListeners(jobId: string): void {
        const eventName = `job:${jobId}`;
        this.removeAllListeners(eventName);
        this.logger.debug(`Removed all listeners for job ${jobId}`);
    }

    /**
     * Get listener count for a job
     * 
     * Useful for debugging/monitoring
     * 
     * @param jobId - Job identifier
     * @returns Number of active listeners
     */
    getJobListenerCount(jobId: string): number {
        const eventName = `job:${jobId}`;
        return this.listenerCount(eventName);
    }

    /**
     * Get all active job IDs with listeners
     * 
     * @returns Array of job IDs
     */
    getActiveJobIds(): string[] {
        return this.eventNames()
            .filter((name) => typeof name === 'string' && name.startsWith('job:'))
            .map((name) => (name as string).replace('job:', ''));
    }
}

/**
 * Export singleton instance for convenience
 * 
 * Usage in nodes:
 *   import { jobEventEmitter } from './events/job-event-emitter.service';
 *   jobEventEmitter.emitJobEvent(jobId, createStageStartedEvent({ ... }));
 */
export const jobEventEmitter = JobEventEmitterService.getInstance();
