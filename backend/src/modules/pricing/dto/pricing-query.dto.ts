import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum CloudProvider {
    AWS = 'aws',
    AZURE = 'azure',
    GCP = 'gcp',
}

export class PricingQueryDto {
    @IsString()
    @IsOptional()
    region?: string = 'us-east-1';

    @IsEnum(CloudProvider)
    @IsOptional()
    cloud?: CloudProvider = CloudProvider.AWS;
}
