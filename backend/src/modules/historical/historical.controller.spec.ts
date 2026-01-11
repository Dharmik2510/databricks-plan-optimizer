import { BadRequestException, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { ExecutionContext } from '@nestjs/common';
import { HistoricalController } from './historical.controller';
import { HistoricalService } from './historical.service';
import { HistoricalRateLimitGuard } from './historical-rate-limit.guard';
import { JwtAuthGuard } from '../../common/guards';

describe('HistoricalController', () => {
  let app: INestApplication;
  const service = {
    analyze: jest.fn(),
    compare: jest.fn(),
    getHistory: jest.fn(),
    listRuns: jest.fn(),
    getById: jest.fn(),
    updateAnalysis: jest.fn(),
  };

  const authGuard = {
    canActivate: (context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest();
      req.user = { id: 'user-1', orgId: 'org-1', role: 'ADMIN', isActive: true };
      return true;
    },
  };

  const rateGuard = { canActivate: () => true };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HistoricalController],
      providers: [
        { provide: HistoricalService, useValue: service },
        HistoricalRateLimitGuard,
        JwtAuthGuard,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(authGuard)
      .overrideGuard(HistoricalRateLimitGuard)
      .useValue(rateGuard)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /historical/analyze returns analysis result', async () => {
    service.analyze.mockResolvedValue({ id: 'analysis-1' });

    await request(app.getHttpServer())
      .post('/historical/analyze')
      .send({ appId: 'spark-12345' })
      .expect(201)
      .expect({ id: 'analysis-1' });

    expect(service.analyze).toHaveBeenCalledWith('user-1', 'org-1', { appId: 'spark-12345' }, 'ADMIN');
  });

  it('POST /historical/analyze handles service failure', async () => {
    service.analyze.mockRejectedValue(new BadRequestException('bad'));

    const response = await request(app.getHttpServer())
      .post('/historical/analyze')
      .send({ appId: 'spark-12345' })
      .expect(400);

    expect(response.body.message).toBe('bad');
  });

  it('POST /historical/compare returns comparison result', async () => {
    service.compare.mockResolvedValue({ id: 'comparison-1' });

    await request(app.getHttpServer())
      .post('/historical/compare')
      .send({ appIdA: 'spark-aaaa', appIdB: 'spark-bbbb' })
      .expect(201)
      .expect({ id: 'comparison-1' });

    expect(service.compare).toHaveBeenCalledWith('user-1', 'org-1', { appIdA: 'spark-aaaa', appIdB: 'spark-bbbb' });
  });
});
