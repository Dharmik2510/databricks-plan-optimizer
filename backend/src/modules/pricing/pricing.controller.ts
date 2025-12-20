import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { PricingQueryDto, CloudProvider } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('pricing')
export class PricingController {
    constructor(private readonly pricingService: PricingService) { }

    /**
     * Get cloud instance pricing
     * GET /api/v1/pricing/instances?region=us-east-1&cloud=aws
     */
    @Get('instances')
    async getInstances(@Query() query: PricingQueryDto) {
        return this.pricingService.getInstancePricing(
            query.region || 'us-east-1',
            query.cloud || CloudProvider.AWS,
        );
    }

    /**
     * Get available regions for each cloud provider
     * GET /api/v1/pricing/regions?cloud=aws
     */
    @Get('regions')
    async getRegions(@Query('cloud') cloud?: string) {
        return this.pricingService.getAvailableRegions(cloud as CloudProvider);
    }

    /**
     * Get recommended cluster configurations
     * GET /api/v1/pricing/clusters
     */
    @Get('clusters')
    async getClusters() {
        return this.pricingService.getClusterConfigurations();
    }
}
