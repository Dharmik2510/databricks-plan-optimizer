import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppLoggerService } from '../logging/app-logger.service';
import { lookup } from 'dns/promises';
import { isIP } from 'net';

@Injectable()
export class UrlSafetyService {
  private readonly allowPrivate: boolean;
  private readonly allowlist: string[];

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: AppLoggerService,
  ) {
    this.allowPrivate = this.configService.get<string>('MCP_ALLOW_PRIVATE', 'false') === 'true';
    const allowlistRaw = this.configService.get<string>('MCP_ALLOWED_HOSTS', '');
    this.allowlist = allowlistRaw
      .split(',')
      .map(entry => entry.trim())
      .filter(Boolean);
  }

  async assertSafeUrl(url: string): Promise<void> {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch (error) {
      throw new Error('Invalid MCP server URL');
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('MCP server URL must use http or https');
    }

    if (parsed.username || parsed.password) {
      throw new Error('MCP server URL must not include credentials');
    }

    const hostname = parsed.hostname.toLowerCase();

    if (this.allowlist.length > 0 && !this.allowlist.includes(hostname)) {
      throw new Error('MCP server host is not in the allowlist');
    }

    if (!this.allowPrivate) {
      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
        throw new Error('MCP server URL must not target localhost');
      }

      if (hostname === 'metadata.google.internal' || hostname === 'metadata' || hostname.startsWith('metadata.')) {
        throw new Error('MCP server URL must not target metadata endpoints');
      }

      const ip = isIP(hostname) ? hostname : null;
      if (ip && this.isPrivateIp(ip)) {
        throw new Error('MCP server URL must not target private IPs');
      }

      if (!ip) {
        try {
          const resolved = await lookup(hostname, { all: true, verbatim: true });
          if (resolved.some(record => this.isPrivateIp(record.address))) {
            throw new Error('MCP server URL resolves to a private IP');
          }
        } catch (error) {
          this.logger.warn('Failed to resolve MCP host for SSRF protection', { hostname });
        }
      }
    }
  }

  private isPrivateIp(address: string): boolean {
    if (address.includes(':')) {
      // IPv6 ranges
      return (
        address.startsWith('fc') ||
        address.startsWith('fd') ||
        address === '::1' ||
        address.startsWith('fe80')
      );
    }

    const octets = address.split('.').map(octet => parseInt(octet, 10));
    if (octets.length !== 4 || octets.some(Number.isNaN)) {
      return false;
    }

    const [a, b] = octets;

    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
    if (a === 192 && b === 0) return true;

    return false;
  }
}
