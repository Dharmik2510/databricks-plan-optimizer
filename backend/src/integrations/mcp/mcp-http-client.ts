import { fetchWithTimeout } from '../../common/http/http.utils';

interface McpRequest {
  jsonrpc: '2.0';
  id?: number;
  method: string;
  params?: any;
}

interface McpResponse {
  jsonrpc: '2.0';
  id?: number;
  result?: any;
  error?: { code: number; message: string; data?: any };
}

export interface McpToolDefinition {
  name: string;
  description?: string;
  inputSchema?: any;
}

export interface McpHttpClientOptions {
  url: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  protocolVersion?: string;
}

export class McpHttpClient {
  private idCounter = 1;
  private sessionId?: string;

  constructor(private readonly options: McpHttpClientOptions) {}

  async initialize(): Promise<void> {
    await this.request('initialize', {
      protocolVersion: this.options.protocolVersion || '2024-11-05',
      capabilities: {
        roots: { listChanged: false },
      },
      clientInfo: {
        name: 'brickoptima-historical',
        version: process.env.APP_VERSION || 'dev',
      },
    });

    await this.notify('notifications/initialized', {});
  }

  async listTools(): Promise<McpToolDefinition[]> {
    const result = await this.request('tools/list', {});
    return result?.tools || [];
  }

  async callTool(name: string, args: Record<string, any>): Promise<any> {
    const result = await this.request('tools/call', { name, arguments: args });
    return result;
  }

  private async notify(method: string, params?: any): Promise<void> {
    const message: McpRequest = {
      jsonrpc: '2.0',
      method,
      params,
    };

    await this.send(message, false);
  }

  private async request(method: string, params?: any): Promise<any> {
    const id = this.idCounter++;
    const message: McpRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    const response = await this.send(message, true);
    if (!response) {
      throw new Error(`Empty response from MCP for ${method}`);
    }

    if (response.error) {
      const err = new Error(response.error.message || 'MCP error');
      (err as any).code = response.error.code;
      (err as any).data = response.error.data;
      throw err;
    }

    return response.result;
  }

  private async send(message: McpRequest, expectResponse: boolean): Promise<McpResponse | null> {
    const headers: Record<string, string> = {
      accept: 'application/json, text/event-stream',
      'content-type': 'application/json',
      ...(this.options.headers || {}),
    };

    if (this.sessionId) {
      headers['mcp-session-id'] = this.sessionId;
    }

    if (this.options.protocolVersion) {
      headers['mcp-protocol-version'] = this.options.protocolVersion;
    }

    const response = await fetchWithTimeout(
      this.options.url,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(message),
      },
      this.options.timeoutMs || 15000,
    );

    const sessionId = response.headers.get('mcp-session-id');
    if (sessionId) {
      this.sessionId = sessionId;
    }

    if (!expectResponse) {
      await response.body?.cancel();
      return null;
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`MCP HTTP ${response.status}: ${text || response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const data = await response.json();
      return this.extractResponse(data, message.id);
    }

    if (contentType.includes('text/event-stream')) {
      const raw = await this.readSsePayload(response);
      const messages = this.parseSseMessages(raw);
      return this.extractResponse(messages, message.id);
    }

    throw new Error(`Unexpected MCP response content-type: ${contentType}`);
  }

  private extractResponse(payload: any, requestId?: number): McpResponse | null {
    if (!payload) return null;

    if (Array.isArray(payload)) {
      if (requestId !== undefined) {
        return payload.find((item) => item?.id === requestId) || payload[payload.length - 1];
      }
      return payload[payload.length - 1];
    }

    return payload as McpResponse;
  }

  private parseSseMessages(raw: string): McpResponse[] {
    const events = raw.split('\n\n');
    const messages: McpResponse[] = [];

    for (const event of events) {
      const lines = event.split('\n');
      let dataPayload = '';
      for (const line of lines) {
        if (line.startsWith('data:')) {
          dataPayload += line.replace(/^data:\s?/, '');
        }
      }
      if (!dataPayload) {
        continue;
      }
      try {
        const parsed = JSON.parse(dataPayload);
        if (Array.isArray(parsed)) {
          messages.push(...parsed);
        } else {
          messages.push(parsed);
        }
      } catch {
        // Ignore malformed events
      }
    }

    return messages;
  }

  private async readSsePayload(response: Response): Promise<string> {
    const body = response.body as any;
    if (!body) {
      return '';
    }

    // node-fetch v2 uses Node.js Readable streams; stop after first SSE frame.
    if (typeof body.on === 'function') {
      return new Promise((resolve, reject) => {
        let buffer = '';
        const onData = (chunk: Buffer) => {
          buffer += chunk.toString('utf8');
          if (buffer.includes('\n\n')) {
            cleanup();
            resolve(buffer);
          }
        };
        const onEnd = () => {
          cleanup();
          resolve(buffer);
        };
        const onError = (error: Error) => {
          cleanup();
          reject(error);
        };
        const cleanup = () => {
          body.off('data', onData);
          body.off('end', onEnd);
          body.off('error', onError);
          if (typeof body.destroy === 'function') {
            body.destroy();
          }
        };

        body.on('data', onData);
        body.on('end', onEnd);
        body.on('error', onError);
      });
    }

    return response.text();
  }
}
