import { Test, TestingModule } from '@nestjs/testing';
import { DbrService } from './dbr.service';
import { PrismaService } from '../../prisma/prisma.service';
import axios from 'axios';

jest.mock('axios');

const mockHtml = `
<html>
<body>
<h2>All supported Databricks Runtime releases</h2>
<div class="table-wrapper">
<table>
  <thead>
    <tr>
      <th>Version</th>
      <th>Variants</th>
      <th>Apache Spark version</th>
      <th>Release date</th>
      <th>End-of-support date</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>15.4 LTS</td>
      <td>Variants...</td>
      <td>3.5.0</td>
      <td>Aug 19, 2024</td>
      <td>Aug 19, 2027</td>
    </tr>
    <tr>
      <td>15.3</td>
      <td>Variants...</td>
      <td>3.5.0</td>
      <td>Jul 10, 2024</td>
      <td>Jan 10, 2025</td>
    </tr>
    <tr>
      <td>18.0 (Beta)</td>
      <td>Variants...</td>
      <td>4.0.0</td>
      <td>Oct 10, 2025</td>
      <td>Oct 10, 2026</td>
    </tr>
  </tbody>
</table>
</div>
</body>
</html>
`;

describe('DbrService', () => {
    let service: DbrService;
    let prisma: PrismaService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                DbrService,
                {
                    provide: PrismaService,
                    useValue: {
                        dbrVersionCache: {
                            findUnique: jest.fn(),
                            upsert: jest.fn(),
                        },
                    },
                },
            ],
        }).compile();

        service = module.get<DbrService>(DbrService);
        prisma = module.get<PrismaService>(PrismaService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('getVersions', () => {
        it('should return cached versions if valid', async () => {
            const mockCache = {
                cloud: 'aws',
                versions: [{ majorMinor: '14.3' }],
                expiresAt: new Date(Date.now() + 100000), // Valid
                updatedAt: new Date(),
            };
            ((prisma as any).dbrVersionCache.findUnique as jest.Mock).mockResolvedValue(mockCache);

            const result = await service.getVersions('aws');
            expect(result.source).toBe('cache');
            expect(result.versions).toHaveLength(1);
            expect(axios.get).not.toHaveBeenCalled();
        });

        it('should fetch and parse if cache is missing', async () => {
            ((prisma as any).dbrVersionCache.findUnique as jest.Mock).mockResolvedValue(null);
            (axios.get as jest.Mock).mockResolvedValue({ data: mockHtml });
            ((prisma as any).dbrVersionCache.upsert as jest.Mock).mockResolvedValue({});

            const result = await service.getVersions('aws');

            expect(result.source).toBe('databricks-docs');
            expect(result.versions).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ majorMinor: '18.0', isLts: false }),
                    expect.objectContaining({ majorMinor: '15.4', isLts: true }),
                    expect.objectContaining({ majorMinor: '15.3', isLts: false }),
                ])
            );
            // Verify sorting/ordering if necessary
            // The result.versions type is DbrVersion[], so indexing is fine if we suppressed other errors, but safe navigation is better
            expect(result.versions[0]?.majorMinor).toBe('18.0');

            expect((prisma as any).dbrVersionCache.upsert).toHaveBeenCalled();
        });

        it('should handle dates correctly', async () => {
            ((prisma as any).dbrVersionCache.findUnique as jest.Mock).mockResolvedValue(null);
            (axios.get as jest.Mock).mockResolvedValue({ data: mockHtml });
            ((prisma as any).dbrVersionCache.upsert as jest.Mock).mockResolvedValue({});

            const result = await service.getVersions('aws');
            const v154 = result.versions.find(v => v.majorMinor === '15.4');
            expect(v154).toBeDefined();
            if (v154) {
                expect(v154.releaseDate).toBe('2024-08-19');
            }
        });
    });
});
