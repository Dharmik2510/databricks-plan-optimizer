import { BadRequestException, NotFoundException } from '@nestjs/common';
import { HistoricalService } from './historical.service';
import { AnalyzeHistoricalDto } from './dto';

describe('HistoricalService resolution', () => {
  const configService = {
    get: jest.fn((key: string, defaultValue?: any) => defaultValue),
  };

  const service = new HistoricalService(
    configService as any,
    {} as any,
    { warn: jest.fn(), log: jest.fn() } as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );

  const serviceAny = service as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses appId directly when provided', async () => {
    const dto: AnalyzeHistoricalDto = { appId: 'spark-abc123', appName: 'Job' };
    const result = await serviceAny.resolveAppId('user-1', 'org-1', dto, 'MEMBER');

    expect(result).toEqual({ appId: 'spark-abc123', appName: 'Job', selectedBy: 'appId' });
  });

  it('resolves latest run when using appName + date range', async () => {
    serviceAny.getMcpConnection = jest.fn().mockResolvedValue({ mcpConfig: {} });
    serviceAny.fetchRuns = jest.fn().mockResolvedValue([
      { appId: 'spark-latest', appName: 'Job A' },
      { appId: 'spark-old', appName: 'Job A' },
    ]);

    const dto: AnalyzeHistoricalDto = {
      appName: 'Job A',
      startTime: '2024-01-01T00:00:00Z',
      endTime: '2024-01-02T00:00:00Z',
    };

    const result = await serviceAny.resolveAppId('user-1', 'org-1', dto, 'MEMBER');
    expect(result.appId).toBe('spark-latest');
    expect(result.selectedBy).toBe('latest');
  });

  it('throws when no runs are found for appName', async () => {
    serviceAny.getMcpConnection = jest.fn().mockResolvedValue({ mcpConfig: {} });
    serviceAny.fetchRuns = jest.fn().mockResolvedValue([]);

    const dto: AnalyzeHistoricalDto = {
      appName: 'Missing Job',
      startTime: '2024-01-01T00:00:00Z',
      endTime: '2024-01-02T00:00:00Z',
    };

    await expect(serviceAny.resolveAppId('user-1', 'org-1', dto, 'MEMBER')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('validates date ranges and rejects invalid input', () => {
    expect(() => serviceAny.validateDateRange('2024-01-02T00:00:00Z', '2024-01-01T00:00:00Z', 'MEMBER'))
      .toThrow(BadRequestException);
  });
});
