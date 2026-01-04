import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as readline from 'readline';
import * as zlib from 'zlib';

export interface StageMetrics {
    stageId: number;
    name: string;
    submissionTime: number;
    completionTime: number;
    durationSeconds: number;
    numTasks: number;
    shuffleReadBytes: number;
    shuffleWriteBytes: number;
    memoryBytesSpilled: number;
    diskBytesSpilled: number;
    taskDurations: number[]; // For skew calculation
}

export interface ParsedEventLog {
    applicationId: string;
    startTime: number;
    endTime: number;
    totalRuntimeSeconds: number;
    baselineConfidence: 'measured' | 'approximate' | 'insufficient';
    stages: StageMetrics[];
    bottlenecks: string[];
}

@Injectable()
export class EventLogParser {
    private readonly logger = new Logger(EventLogParser.name);

    async parseLogFile(filePath: string): Promise<ParsedEventLog> {
        const isGzipped = filePath.endsWith('.gz');
        const fileStream = fs.createReadStream(filePath);
        const rl = readline.createInterface({
            input: isGzipped ? fileStream.pipe(zlib.createGunzip()) : fileStream,
            crlfDelay: Infinity,
        });

        let appId = '';
        let appStartTime = 0;
        let appEndTime = 0;
        const stages = new Map<number, StageMetrics>();

        try {
            let buffer = '';
            for await (const line of rl) {
                const trimmed = line.trim();
                if (!trimmed) continue;

                buffer += line + '\n';

                try {
                    const event = JSON.parse(buffer);
                    this.processEvent(event, { setAppId: (id: string) => appId = id, stages });

                    // Update reliable vars as they are found
                    if (event.Event === 'SparkListenerApplicationStart') {
                        appId = event['App ID'] || event.appId || '';
                        appStartTime = event['Timestamp'] || event.time || 0;
                    }
                    if (event.Event === 'SparkListenerApplicationEnd') {
                        appEndTime = event['Timestamp'] || event.time || 0;
                    }

                    // Reset buffer after successful parse
                    buffer = '';

                } catch (e) {
                    // If buffer is too large, it's likely garbage or a massive non-event object
                    if (buffer.length > 5 * 1024 * 1024) { // 5MB limit per event
                        this.logger.warn('Skipping malformed/too-large block in event log');
                        buffer = '';
                    }
                    // Continue accumulating lines
                }
            }
        } catch (err) {
            this.logger.error(`Error reading event log stream: ${err}`);
            throw new Error('Failed to read event log file');
        }

        if (stages.size === 0 && !appId) {
            throw new Error('No valid Spark events found in log file. The file format might be unsupported.');
        }

        // Finalize metrics
        const stageList = Array.from(stages.values()).map(stage => {
            // Ensure duration is set if missing
            if (stage.durationSeconds === 0 && stage.completionTime > 0 && stage.submissionTime > 0) {
                stage.durationSeconds = (stage.completionTime - stage.submissionTime) / 1000;
            }
            return stage;
        }).sort((a, b) => a.stageId - b.stageId);

        // Determine baseline confidence and total runtime
        let totalRuntimeSeconds = 0;
        let confidence: 'measured' | 'approximate' | 'insufficient' = 'insufficient';

        if (appStartTime > 0 && appEndTime > 0) {
            totalRuntimeSeconds = (appEndTime - appStartTime) / 1000;
            confidence = 'measured';
        } else if (stageList.length > 0) {
            // Fallback: derived from min/max stage times
            const minStart = Math.min(...stageList.filter(s => s.submissionTime > 0).map(s => s.submissionTime));
            const maxEnd = Math.max(...stageList.filter(s => s.completionTime > 0).map(s => s.completionTime));

            if (minStart < Infinity && maxEnd > 0 && maxEnd > minStart) {
                totalRuntimeSeconds = (maxEnd - minStart) / 1000;
                confidence = 'approximate';
            }
        }

        return {
            applicationId: appId,
            startTime: appStartTime,
            endTime: appEndTime,
            totalRuntimeSeconds,
            baselineConfidence: confidence,
            stages: stageList,
            bottlenecks: this.identifyBottlenecks(stageList, totalRuntimeSeconds)
        };
    }

    private processEvent(event: any, context: any) {
        const { stages } = context;

        switch (event.Event) {
            case 'SparkListenerStageSubmitted': {
                const info = event['Stage Info'];
                if (info) {
                    const stageId = info['Stage ID'];
                    if (!stages.has(stageId)) {
                        stages.set(stageId, this.initStage(stageId, info['Stage Name']));
                    }
                    const stage = stages.get(stageId);
                    if (stage) {
                        stage.submissionTime = info['Submission Time'] || event['Timestamp'] || 0;
                        stage.name = info['Stage Name'] || stage.name;
                        stage.numTasks = info['Number of Tasks'] || 0;
                    }
                }
                break;
            }

            case 'SparkListenerStageCompleted': {
                const info = event['Stage Info'];
                if (info) {
                    const stageId = info['Stage ID'];
                    if (!stages.has(stageId)) {
                        stages.set(stageId, this.initStage(stageId, info['Stage Name']));
                    }
                    const stage = stages.get(stageId);
                    if (stage) {
                        stage.completionTime = info['Completion Time'] || event['Timestamp'] || 0;
                        if (stage.submissionTime === 0 && info['Submission Time']) {
                            stage.submissionTime = info['Submission Time'];
                        }
                    }
                }
                break;
            }

            case 'SparkListenerTaskEnd': {
                const stageId = event['Stage ID'];
                const metrics = event['Task Metrics'];
                const info = event['Task Info'];

                if (stageId !== undefined) {
                    if (!stages.has(stageId)) {
                        stages.set(stageId, this.initStage(stageId, `Stage ${stageId}`));
                    }
                    const stage = stages.get(stageId);

                    if (metrics) {
                        // Shuffle
                        if (metrics['Shuffle Read Metrics']) {
                            stage.shuffleReadBytes += (metrics['Shuffle Read Metrics']['Remote Bytes Read'] || 0) + (metrics['Shuffle Read Metrics']['Local Bytes Read'] || 0);
                        }
                        if (metrics['Shuffle Write Metrics']) {
                            stage.shuffleWriteBytes += (metrics['Shuffle Write Metrics']['Shuffle Bytes Written'] || 0);
                        }

                        // Spill
                        stage.memoryBytesSpilled += (metrics['Memory Bytes Spilled'] || 0);
                        stage.diskBytesSpilled += (metrics['Disk Bytes Spilled'] || 0);
                    }

                    // Duration
                    if (info && info['Duration']) {
                        stage.taskDurations.push(info['Duration']);
                    }
                }
                break;
            }
        }
    }

    private initStage(id: number, name: string): StageMetrics {
        return {
            stageId: id,
            name,
            submissionTime: 0,
            completionTime: 0,
            durationSeconds: 0,
            numTasks: 0,
            shuffleReadBytes: 0,
            shuffleWriteBytes: 0,
            memoryBytesSpilled: 0,
            diskBytesSpilled: 0,
            taskDurations: []
        };
    }

    private identifyBottlenecks(stages: StageMetrics[], totalRuntime: number): string[] {
        const bottlenecks: string[] = [];

        stages.forEach(stage => {
            // Significant stage
            if (totalRuntime > 0 && stage.durationSeconds > totalRuntime * 0.3 && stage.durationSeconds > 60) {
                bottlenecks.push(`Stage ${stage.stageId} consumes ${(stage.durationSeconds / totalRuntime * 100).toFixed(0)}% of runtime`);
            }

            // Spill
            if (stage.diskBytesSpilled > 0) {
                bottlenecks.push(`Stage ${stage.stageId} spills to disk (${(stage.diskBytesSpilled / 1024 / 1024).toFixed(1)} MB)`);
            }

            // Skew
            if (stage.taskDurations.length > 10) {
                const sorted = [...stage.taskDurations].sort((a, b) => a - b);
                const p95 = sorted[Math.floor(sorted.length * 0.95)];
                const median = sorted[Math.floor(sorted.length * 0.5)];
                if (median > 0 && p95 > median * 5 && p95 > 10000) {
                    bottlenecks.push(`Stage ${stage.stageId} has severe data skew (P95 task is ${Math.round(p95 / median)}x median)`);
                }
            }
        });

        return bottlenecks.slice(0, 20);
    }
}
