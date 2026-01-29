import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import axios from 'axios';
import * as cheerio from 'cheerio';

export interface DbrVersion {
    majorMinor: string;
    displayLabel: string;
    isLts: boolean;
    releaseDate: string | null;
    eolDate: string | null;
}

@Injectable()
export class DbrService {
    private readonly logger = new Logger(DbrService.name);
    private readonly DOCS_URL = 'https://docs.databricks.com/en/release-notes/runtime/index.html';
    private readonly DEFAULT_TTL = 86400; // 24 hours

    constructor(private prisma: PrismaService) { }

    async getVersions(cloud: string): Promise<{
        source: string;
        cloud: string;
        generatedAt: string;
        ttlSeconds: number;
        versions: DbrVersion[];
    }> {
        const startTime = Date.now();

        try {
            this.logger.log('Fetching DBR versions', { cloud });

            // 1. Check cache
            try {
                this.logger.log('Checking DBR version cache', { cloud });

                const cache = await this.prisma.dbrVersionCache.findUnique({
                    where: { cloud },
                });

                if (cache && cache.expiresAt > new Date()) {
                    const cacheAge = Date.now() - cache.updatedAt.getTime();
                    this.logger.log('✅ Serving DBR versions from cache', {
                        cloud,
                        source: 'cache',
                        cacheAgeMs: cacheAge,
                        versionCount: (cache.versions as unknown as DbrVersion[]).length,
                        expiresAt: cache.expiresAt.toISOString(),
                    });

                    return {
                        source: 'cache',
                        cloud,
                        generatedAt: cache.updatedAt.toISOString(),
                        ttlSeconds: this.DEFAULT_TTL,
                        versions: cache.versions as unknown as DbrVersion[],
                    };
                }

                if (cache) {
                    this.logger.log('Cache exists but is stale, will attempt fresh fetch', {
                        cloud,
                        expiresAt: cache.expiresAt.toISOString(),
                    });
                }
            } catch (error) {
                this.logger.warn('Cache check failed, proceeding to fetch', {
                    cloud,
                    error: error instanceof Error ? error.message : String(error),
                });
            }

            // 2. Fetch and parse
            try {
                this.logger.log('Fetching DBR versions from Databricks documentation', {
                    url: this.DOCS_URL,
                    cloud,
                });

                const fetchStartTime = Date.now();
                const versions = await this.fetchAndParse();
                const fetchLatency = Date.now() - fetchStartTime;

                this.logger.log('✅ DBR versions fetched and parsed successfully', {
                    latencyMs: fetchLatency,
                    versionCount: versions.length,
                    latestVersion: versions[0]?.majorMinor,
                });

                // 3. Save to cache
                this.logger.log('Saving DBR versions to cache', { cloud, versionCount: versions.length });

                const expiresAt = new Date();
                expiresAt.setSeconds(expiresAt.getSeconds() + this.DEFAULT_TTL);

                await this.prisma.dbrVersionCache.upsert({
                    where: { cloud },
                    update: {
                        versions: versions as any,
                        expiresAt,
                    },
                    create: {
                        cloud,
                        versions: versions as any,
                        expiresAt,
                    },
                });

                this.logger.log('✅ DBR versions cached successfully', {
                    cloud,
                    expiresAt: expiresAt.toISOString(),
                    ttlSeconds: this.DEFAULT_TTL,
                });

                const totalLatency = Date.now() - startTime;
                this.logger.log('✅ DBR version fetch completed', {
                    cloud,
                    source: 'databricks-docs',
                    totalLatencyMs: totalLatency,
                    fetchLatencyMs: fetchLatency,
                    versionCount: versions.length,
                });

                return {
                    source: 'databricks-docs',
                    cloud,
                    generatedAt: new Date().toISOString(),
                    ttlSeconds: this.DEFAULT_TTL,
                    versions,
                };
            } catch (e) {
                this.logger.error('❌ Failed to fetch DBR versions from docs', {
                    cloud,
                    url: this.DOCS_URL,
                    error: e instanceof Error ? e.message : String(e),
                    stack: e instanceof Error ? e.stack : undefined,
                });

                // Fallback to stale cache if exists
                try {
                    const cache = await this.prisma.dbrVersionCache.findUnique({
                        where: { cloud },
                    });

                    if (cache) {
                        const cacheAge = Date.now() - cache.updatedAt.getTime();
                        this.logger.warn('⚠️ Serving stale cache due to fetch failure', {
                            cloud,
                            source: 'cache-stale',
                            cacheAgeMs: cacheAge,
                            updatedAt: cache.updatedAt.toISOString(),
                            versionCount: (cache.versions as unknown as DbrVersion[]).length,
                        });

                        return {
                            source: 'cache-stale',
                            cloud,
                            generatedAt: cache.updatedAt.toISOString(),
                            ttlSeconds: 0,
                            versions: cache.versions as unknown as DbrVersion[],
                        };
                    }
                } catch (cacheError) {
                    this.logger.error('❌ Failed to retrieve stale cache', {
                        cloud,
                        error: cacheError instanceof Error ? cacheError.message : String(cacheError),
                    });
                }

                // If no cache, return empty or throw. Returning valid empty structure is safer for UI.
                // But user requested "show current hardcoded list as fallback" which is in UI.
                // We can return a specific error code or empty list.
                throw e;
            }
        } catch (error) {
            const totalLatency = Date.now() - startTime;
            this.logger.error('❌ Failed to get DBR versions', {
                cloud,
                latencyMs: totalLatency,
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
            });
            throw error;
        }
    }

    private async fetchAndParse(): Promise<DbrVersion[]> {
        try {
            this.logger.log('Fetching HTML from Databricks docs', { url: this.DOCS_URL });

            const fetchStartTime = Date.now();
            const { data } = await axios.get(this.DOCS_URL);
            const fetchLatency = Date.now() - fetchStartTime;

            this.logger.log('✅ HTML fetched successfully', {
                latencyMs: fetchLatency,
                htmlSize: data.length,
            });

            this.logger.log('Parsing HTML with Cheerio');
            const $ = cheerio.load(data);
            const versions: DbrVersion[] = [];

            // Find the section "All supported Databricks Runtime releases"
            // The anchor ID is typically #all-supported-databricks-runtime-releases
            // We look for the h2 with that id, then the next table.

            // Sometimes the ID might change, so searching by text is also good fallback.
            let table = $('#all-supported-databricks-runtime-releases').nextAll('div.table-wrapper').first().find('table');

            if (table.length === 0) {
                this.logger.log('Table not found by anchor ID, searching by header text');
                // Fallback: search for header text
                $('h2').each((_, el) => {
                    if ($(el).text().includes('All supported Databricks Runtime releases')) {
                        table = $(el).nextAll('div.table-wrapper').first().find('table');
                    }
                });
            }

            if (table.length === 0) {
                // Try finding ANY table after "supported"
                // This is a last resort.
                this.logger.warn('⚠️ Could not pinpoint the exact table, trying first table');
                table = $('table').first();
            }

            if (table.length === 0) {
                throw new Error('No table found in Databricks documentation');
            }

            this.logger.log('Table found, parsing rows');
            let rowsParsed = 0;

            table.find('tbody tr').each((_, row) => {
                const cols = $(row).find('td');
                if (cols.length >= 1) {
                    // Column 0: Version generally contains text like "15.4 LTS" or "15.2" or "18.0 (Beta)"
                    // It might be a link.
                    let rawVersion = $(cols[0]).text().trim();

                    // Sometimes it has newlines or extra spaces
                    rawVersion = rawVersion.replace(/\s+/g, ' ').trim();

                    const isLts = rawVersion.toUpperCase().includes('LTS');

                    // Extract Major.Minor
                    // Regex to capture "14.3" from "14.3 LTS" or "18.0 (Beta)"
                    const match = rawVersion.match(/(\d+\.\d+)/);
                    if (match) {
                        const majorMinor = match[1];

                        // Dates are typically col 3 (Release) and 4 (End of Support), but check headers?
                        // Assuming simplified fixed index for now as per "minimal churn".
                        // 0: Version, 1: Variants, 2: Spark Version, 3: Release date, 4: EOL

                        // Cleaning dates: "Aug 19, 2024" -> "2024-08-19"
                        const releaseDateRaw = $(cols[3]).text().trim();
                        const eolDateRaw = $(cols[4]).text().trim();

                        versions.push({
                            majorMinor,
                            displayLabel: rawVersion,
                            isLts,
                            releaseDate: this.parseDate(releaseDateRaw),
                            eolDate: this.parseDate(eolDateRaw)
                        });
                        rowsParsed++;
                    }
                }
            });

            this.logger.log('Table rows parsed', { rowsParsed, versionsExtracted: versions.length });

            // Sorting: Highest majorMinor first
            versions.sort((a, b) => {
                return parseFloat(b.majorMinor) - parseFloat(a.majorMinor);
            });

            // De-duplicate if needed (sometimes variants cause dupes if logic is loose)
            const uniqueVersions = versions.filter((v, i, a) => a.findIndex(df => df.majorMinor === v.majorMinor) === i);

            if (uniqueVersions.length < versions.length) {
                this.logger.log('Duplicates removed', {
                    before: versions.length,
                    after: uniqueVersions.length,
                    duplicatesRemoved: versions.length - uniqueVersions.length,
                });
            }

            this.logger.log('✅ DBR versions parsed successfully', {
                totalVersions: uniqueVersions.length,
                latestVersion: uniqueVersions[0]?.majorMinor,
                oldestVersion: uniqueVersions[uniqueVersions.length - 1]?.majorMinor,
                ltsCount: uniqueVersions.filter(v => v.isLts).length,
            });

            return uniqueVersions;
        } catch (error) {
            this.logger.error('❌ Failed to fetch and parse DBR versions', {
                url: this.DOCS_URL,
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
            });
            throw error;
        }
    }

    private parseDate(dateStr: string): string | null {
        try {
            if (!dateStr || dateStr.trim() === '') {
                return null;
            }

            const d = new Date(dateStr);
            if (isNaN(d.getTime())) {
                this.logger.warn('Failed to parse date', { dateStr });
                return null;
            }

            return d.toISOString().split('T')[0];
        } catch (error) {
            this.logger.warn('Exception parsing date', {
                dateStr,
                error: error instanceof Error ? error.message : String(error),
            });
            return null;
        }
    }
}
