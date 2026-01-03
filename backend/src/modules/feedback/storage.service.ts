import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

export interface UploadResult {
    storageUrl: string;
    fileName: string;
    fileSize: number;
    fileType: string;
}

/**
 * Storage service for handling file uploads to GCS
 * Falls back to local filesystem storage if GCS is not configured
 */
@Injectable()
export class StorageService {
    private readonly logger = new Logger(StorageService.name);
    private storage: Storage | null = null;
    private bucketName: string;
    private isGcsConfigured = false;
    private localUploadDir: string;

    constructor(private readonly configService: ConfigService) {
        const projectId = this.configService.get<string>('GCP_PROJECT_ID');
        this.bucketName = this.configService.get<string>('GCS_FEEDBACK_BUCKET', 'feedback-attachments');
        this.localUploadDir = path.join(process.cwd(), 'uploads');

        if (projectId) {
            try {
                this.storage = new Storage({ projectId });
                this.isGcsConfigured = true;
                this.logger.log(`GCS configured with bucket: ${this.bucketName}`);
            } catch (error) {
                this.logger.warn('GCS not configured, falling back to local storage');
            }
        } else {
            this.logger.warn('GCP_PROJECT_ID not set, falling back to local storage');
        }

        // Ensure local upload directory exists
        if (!this.isGcsConfigured) {
            if (!fs.existsSync(this.localUploadDir)) {
                fs.mkdirSync(this.localUploadDir, { recursive: true });
            }
        }
    }

    /**
     * Upload a file to GCS or save locally
     */
    async uploadFile(
        base64Data: string,
        fileName: string,
        feedbackId: string,
        isScreenshot = false,
    ): Promise<UploadResult> {
        // Extract file type from base64 header
        const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
            throw new Error('Invalid base64 data format');
        }

        const fileType = matches[1];
        const base64Content = matches[2];
        const buffer = Buffer.from(base64Content, 'base64');
        const fileSize = buffer.length;

        // Validate file type for screenshots
        if (isScreenshot && !fileType.startsWith('image/')) {
            throw new Error('Screenshots must be image files');
        }

        // Generate unique file name
        const extension = this.getExtensionFromMimeType(fileType);
        const uniqueFileName = `${feedbackId}_${uuidv4()}.${extension}`;

        if (this.isGcsConfigured && this.storage) {
            try {
                const bucket = this.storage.bucket(this.bucketName);
                const destination = `feedback-attachments/${uniqueFileName}`;
                const file = bucket.file(destination);

                await file.save(buffer, {
                    metadata: {
                        contentType: fileType,
                        metadata: {
                            feedbackId,
                            isScreenshot: String(isScreenshot),
                            originalName: fileName,
                        },
                    },
                });

                const storageUrl = `gs://${this.bucketName}/${destination}`;
                this.logger.log(`File uploaded to GCS: ${storageUrl}`);

                return {
                    storageUrl,
                    fileName: uniqueFileName,
                    fileSize,
                    fileType,
                };
            } catch (error) {
                this.logger.error('Failed to upload to GCS, falling back to local', error);
            }
        }

        // Fallback: store locally
        const filePath = path.join(this.localUploadDir, uniqueFileName);
        fs.writeFileSync(filePath, buffer);

        // Use a special scheme for local files that we can parse later
        const storageUrl = `local://${uniqueFileName}`;
        this.logger.log(`File stored locally: ${filePath}`);

        return {
            storageUrl,
            fileName: uniqueFileName,
            fileSize,
            fileType,
        };
    }

    /**
     * getSignedUrl now returns a View URL.
     * For GCS: Signed URL
     * For Local: API endpoint to serve the file
     */
    async getSignedUrl(storageUrl: string, expiresInMinutes = 60): Promise<string> {
        if (storageUrl.startsWith('gs://') && this.isGcsConfigured && this.storage) {
            try {
                const [, , bucketName, ...pathParts] = storageUrl.split('/');
                const filePath = pathParts.join('/');
                const bucket = this.storage.bucket(bucketName);
                const file = bucket.file(filePath);

                const [signedUrl] = await file.getSignedUrl({
                    version: 'v4',
                    action: 'read',
                    expires: Date.now() + expiresInMinutes * 60 * 1000,
                });

                return signedUrl;
            } catch (error) {
                this.logger.error('Failed to generate signed URL', error);
                return storageUrl;
            }
        }

        if (storageUrl.startsWith('local://')) {
            const fileName = storageUrl.replace('local://', '');
            // Return full URL to API endpoint. Assuming standard PORT 3001 if unknown.
            // But better to return path and let frontend handle base URL or use config.
            // We'll return a relative path that works if hit on the same domain or prepended with API URL
            const apiPrefix = this.configService.get('API_PREFIX', 'api/v1');
            return `/${apiPrefix}/feedback/attachments/local/${fileName}`;
        }

        return storageUrl;
    }

    getFilePath(fileName: string): string {
        return path.join(this.localUploadDir, fileName);
    }

    async deleteFile(storageUrl: string): Promise<void> {
        if (!storageUrl) return;

        if (storageUrl.startsWith('gs://') && this.isGcsConfigured && this.storage) {
            try {
                const [, , bucketName, ...pathParts] = storageUrl.split('/');
                const filePath = pathParts.join('/');
                const bucket = this.storage.bucket(bucketName);
                const file = bucket.file(filePath);

                await file.delete();
                this.logger.log(`File deleted from GCS: ${storageUrl}`);
            } catch (error) {
                this.logger.warn(`Failed to delete file from GCS: ${storageUrl}`, error);
                // Don't throw, we still want to delete the DB record
            }
        } else if (storageUrl.startsWith('local://')) {
            try {
                const fileName = storageUrl.replace('local://', '');
                const filePath = this.getFilePath(fileName);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    this.logger.log(`Local file deleted: ${filePath}`);
                }
            } catch (error) {
                this.logger.warn(`Failed to delete local file: ${storageUrl}`, error);
            }
        }
    }

    private getExtensionFromMimeType(mimeType: string): string {
        const mimeToExt: Record<string, string> = {
            'image/png': 'png',
            'image/jpeg': 'jpg',
            'image/gif': 'gif',
            'image/webp': 'webp',
            'application/pdf': 'pdf',
            'text/plain': 'txt',
        };
        return mimeToExt[mimeType] || 'bin';
    }
}
