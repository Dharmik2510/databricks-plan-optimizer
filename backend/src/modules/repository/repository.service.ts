import { Injectable, Logger } from '@nestjs/common';
import * as simpleGit from 'simple-git';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class RepositoryService {
    private readonly logger = new Logger(RepositoryService.name);

    async scanRepository(url: string, branch: string = 'main', token?: string, fileExtensions: string[] = ['.py', '.scala', '.sql', '.ipynb']) {
        const scanId = uuidv4();
        const tempDir = path.join(os.tmpdir(), `brickoptima-repo-${scanId}`);

        try {
            this.logger.log(`Scanning repository: ${url} (Branch: ${branch})`);

            // 1. Prepare Auth URL
            let authUrl = url;
            if (token && url.startsWith('https://')) {
                authUrl = url.replace('https://', `https://oauth2:${token}@`);
            }

            // 2. Clone Repository
            await simpleGit.default().clone(authUrl, tempDir, ['--depth', '1', '--branch', branch]);

            // 3. Scan Files
            const files: any[] = [];
            await this.scanDirectory(tempDir, tempDir, fileExtensions, files);

            this.logger.log(`Scan completed. Found ${files.length} relevant files.`);
            return files;
        } catch (error) {
            this.logger.error(`Failed to scan repository: ${error.message}`);
            throw new Error(`Repository scan failed: ${error.message}`);
        } finally {
            // 4. Cleanup
            try {
                fs.rmSync(tempDir, { recursive: true, force: true });
                this.logger.log(`Cleaned up temp directory: ${tempDir}`);
            } catch (e) {
                this.logger.warn(`Failed to cleanup temp directory: ${e.message}`);
            }
        }
    }

    private async scanDirectory(rootDir: string, currentDir: string, extensions: string[], result: any[]) {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(currentDir, entry.name);

            // Skip hidden files and common ignore dirs
            if (entry.name.startsWith('.') || ['node_modules', 'target', 'dist', 'build', 'venv', '__pycache__'].includes(entry.name)) {
                continue;
            }

            if (entry.isDirectory()) {
                await this.scanDirectory(rootDir, fullPath, extensions, result);
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                if (extensions.includes(ext)) {
                    const content = fs.readFileSync(fullPath, 'utf-8');
                    const relativePath = path.relative(rootDir, fullPath);

                    result.push({
                        path: relativePath,
                        content: content,
                        size: fs.statSync(fullPath).size,
                        language: this.getLanguageFromExt(ext)
                    });
                }
            }
        }
    }

    private getLanguageFromExt(ext: string): string {
        const map: Record<string, string> = {
            '.py': 'python',
            '.scala': 'scala',
            '.sql': 'sql',
            '.ipynb': 'json',
            '.java': 'java',
            '.r': 'r',
            '.sh': 'shell'
        };
        return map[ext] || 'plaintext';
    }
}
