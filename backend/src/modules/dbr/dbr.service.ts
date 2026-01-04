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
        // 1. Check cache
        try {
            const cache = await this.prisma.dbrVersionCache.findUnique({
                where: { cloud },
            });

            if (cache && cache.expiresAt > new Date()) {
                this.logger.log(`Serving DBR versions from cache for ${cloud}`);
                return {
                    source: 'cache',
                    cloud,
                    generatedAt: cache.updatedAt.toISOString(),
                    ttlSeconds: this.DEFAULT_TTL,
                    versions: cache.versions as unknown as DbrVersion[],
                };
            }

            // If cache is stale but exists, we'll try to fetch new data, but keep it as fallback
        } catch (error) {
            this.logger.warn('Cache check failed, proceeding to fetch', error);
        }

        // 2. Fetch and parse
        try {
            this.logger.log(`Fetching DBR versions from ${this.DOCS_URL}`);
            const versions = await this.fetchAndParse();

            // 3. Save to cache
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

            return {
                source: 'databricks-docs',
                cloud,
                generatedAt: new Date().toISOString(),
                ttlSeconds: this.DEFAULT_TTL,
                versions,
            };
        } catch (e) {
            this.logger.error('Failed to fetch DBR versions', e);

            // Fallback to stale cache if exists
            const cache = await this.prisma.dbrVersionCache.findUnique({
                where: { cloud },
            });

            if (cache) {
                this.logger.warn('Serving stale cache due to fetch failure');
                return {
                    source: 'cache-stale',
                    cloud,
                    generatedAt: cache.updatedAt.toISOString(),
                    ttlSeconds: 0,
                    versions: cache.versions as unknown as DbrVersion[],
                };
            }

            // If no cache, return empty or throw. Returning valid empty structure is safer for UI.
            // But user requested "show current hardcoded list as fallback" which is in UI.
            // We can return a specific error code or empty list.
            throw e;
        }
    }

    private async fetchAndParse(): Promise<DbrVersion[]> {
        const { data } = await axios.get(this.DOCS_URL);
        const $ = cheerio.load(data);
        const versions: DbrVersion[] = [];

        // Find the section "All supported Databricks Runtime releases"
        // The anchor ID is typically #all-supported-databricks-runtime-releases
        // We look for the h2 with that id, then the next table.

        // Sometimes the ID might change, so searching by text is also good fallback.
        let table = $('#all-supported-databricks-runtime-releases').nextAll('div.table-wrapper').first().find('table');

        if (table.length === 0) {
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
            this.logger.warn('Could not pinpoint the exact table, trying first table.');
            table = $('table').first();
        }

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
                }
            }
        });

        // Sorting: Highest majorMinor first
        versions.sort((a, b) => {
            return parseFloat(b.majorMinor) - parseFloat(a.majorMinor);
        });

        // De-duplicate if needed (sometimes variants cause dupes if logic is loose)
        const uniqueVersions = versions.filter((v, i, a) => a.findIndex(df => df.majorMinor === v.majorMinor) === i);

        return uniqueVersions;
    }

    private parseDate(dateStr: string): string | null {
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return null;
            return d.toISOString().split('T')[0];
        } catch {
            return null;
        }
    }
}
