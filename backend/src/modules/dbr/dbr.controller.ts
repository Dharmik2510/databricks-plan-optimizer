import { Controller, Get, Query } from '@nestjs/common';
import { DbrService, DbrVersion } from './dbr.service';

@Controller('runtime-versions')
export class DbrController {
    constructor(private readonly dbrService: DbrService) { }

    @Get()
    async getVersions(@Query('cloud') cloud: string = 'aws') {
        return this.dbrService.getVersions(cloud);
    }
}
