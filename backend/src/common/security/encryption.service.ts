import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'crypto';
import { AppLoggerService } from '../logging/app-logger.service';
import { KeyManagementServiceClient } from '@google-cloud/kms';

export interface EncryptedTokenPayload {
  alg: 'AES-256-GCM';
  ciphertext: string;
  iv: string;
  tag: string;
  wrappedKey?: string | null;
}

@Injectable()
export class EncryptionService {
  private readonly kmsClient?: KeyManagementServiceClient;
  private readonly kmsKeyName?: string;
  private readonly localKey?: Buffer;
  private readonly localKeyId?: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: AppLoggerService,
  ) {
    this.kmsKeyName = this.configService.get<string>('KMS_KEY_NAME') || undefined;

    if (this.kmsKeyName) {
      try {
        this.kmsClient = new KeyManagementServiceClient();
      } catch (error) {
        this.logger.error('Failed to initialize KMS client', error as Error);
      }
    }

    const localKeyRaw = this.configService.get<string>('TOKEN_ENCRYPTION_KEY');
    if (localKeyRaw) {
      const keyBuffer = Buffer.from(localKeyRaw, localKeyRaw.length === 64 ? 'hex' : 'base64');
      if (keyBuffer.length !== 32) {
        throw new Error('TOKEN_ENCRYPTION_KEY must be 32 bytes (base64 or hex)');
      }
      this.localKey = keyBuffer;
      this.localKeyId = `local:${createHash('sha256').update(keyBuffer).digest('hex').slice(0, 12)}`;
    }
  }

  async encryptToken(plaintext: string): Promise<{ payload: EncryptedTokenPayload; kid: string }> {
    const dek = randomBytes(32);
    const iv = randomBytes(12);

    const cipher = createCipheriv('aes-256-gcm', dek, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    if (this.kmsClient && this.kmsKeyName) {
      const [response] = await this.kmsClient.encrypt({
        name: this.kmsKeyName,
        plaintext: dek,
      });

      if (!response.ciphertext) {
        throw new Error('KMS encryption failed: empty ciphertext');
      }

      return {
        payload: {
          alg: 'AES-256-GCM',
          ciphertext: ciphertext.toString('base64'),
          iv: iv.toString('base64'),
          tag: tag.toString('base64'),
          wrappedKey: Buffer.from(response.ciphertext).toString('base64'),
        },
        kid: `kms:${this.kmsKeyName}`,
      };
    }

    if (!this.localKey || !this.localKeyId) {
      throw new Error('No encryption key available: configure KMS_KEY_NAME or TOKEN_ENCRYPTION_KEY');
    }

    return {
      payload: {
        alg: 'AES-256-GCM',
        ciphertext: ciphertext.toString('base64'),
        iv: iv.toString('base64'),
        tag: tag.toString('base64'),
        wrappedKey: null,
      },
      kid: this.localKeyId,
    };
  }

  async decryptToken(payload: EncryptedTokenPayload, kid: string): Promise<string> {
    const iv = Buffer.from(payload.iv, 'base64');
    const tag = Buffer.from(payload.tag, 'base64');
    const ciphertext = Buffer.from(payload.ciphertext, 'base64');

    let dek: Buffer | undefined;

    if (kid.startsWith('kms:')) {
      if (!this.kmsClient || !this.kmsKeyName) {
        throw new Error('KMS client not configured');
      }
      if (!payload.wrappedKey) {
        throw new Error('Missing wrapped key for KMS decryption');
      }

      const [response] = await this.kmsClient.decrypt({
        name: this.kmsKeyName,
        ciphertext: Buffer.from(payload.wrappedKey, 'base64'),
      });

      if (!response.plaintext) {
        throw new Error('KMS decryption failed: empty plaintext');
      }
      dek = Buffer.from(response.plaintext);
    } else {
      if (!this.localKey) {
        throw new Error('Local encryption key not configured');
      }
      dek = this.localKey;
    }

    const decipher = createDecipheriv('aes-256-gcm', dek, iv);
    decipher.setAuthTag(tag);

    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString('utf8');
  }
}
