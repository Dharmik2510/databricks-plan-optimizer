import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { EducationService } from './education.service';
import { NodeEducationInputDto, NodeEducationResponseDto } from './education.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('education')
@UseGuards(JwtAuthGuard)
export class EducationController {
    constructor(private readonly educationService: EducationService) { }

    @Post('node-insights')
    async getNodeInsights(
        @Body() input: NodeEducationInputDto,
    ): Promise<NodeEducationResponseDto> {
        return this.educationService.generateNodeInsights(input);
    }
}
