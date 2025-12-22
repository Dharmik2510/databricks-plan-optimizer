import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { RepositoryService } from './repository.service';

@Controller('repository')
export class RepositoryController {
    constructor(private readonly repositoryService: RepositoryService) { }

    @Post('scan')
    async scanRepository(@Body() body: { url: string; branch?: string; token?: string; fileExtensions?: string[] }) {
        if (!body.url) {
            throw new HttpException('Repository URL is required', HttpStatus.BAD_REQUEST);
        }

        try {
            const files = await this.repositoryService.scanRepository(
                body.url,
                body.branch,
                body.token,
                body.fileExtensions
            );

            return {
                success: true,
                data: files
            };
        } catch (error) {
            throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
