import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AnalysisService } from './analysis.service';
import { CreateAnalysisDto, AnalysisQueryDto } from './dto';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser, CurrentUserData } from '../../common/decorators';

@Controller('analyses')
@UseGuards(JwtAuthGuard)
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  /**
   * Create a new analysis
   * POST /api/v1/analyses
   */
  @Post()
  async create(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreateAnalysisDto,
  ) {
    return this.analysisService.create(user.id, dto);
  }

  /**
   * Get all analyses for current user
   * GET /api/v1/analyses
   */
  @Get()
  async findAll(
    @CurrentUser() user: CurrentUserData,
    @Query() query: AnalysisQueryDto,
  ) {
    return this.analysisService.findAll(user.id, query);
  }

  /**
   * Get a single analysis by ID
   * GET /api/v1/analyses/:id
   */
  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
  ) {
    return this.analysisService.findOne(user.id, id);
  }

  /**
   * Get analysis status (for polling)
   * GET /api/v1/analyses/:id/status
   */
  @Get(':id/status')
  async getStatus(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
  ) {
    return this.analysisService.getStatus(user.id, id);
  }

  /**
   * Retry a failed analysis
   * POST /api/v1/analyses/:id/retry
   */
  @Post(':id/retry')
  @HttpCode(HttpStatus.OK)
  async retry(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
  ) {
    return this.analysisService.retry(user.id, id);
  }

  /**
   * Delete an analysis
   * DELETE /api/v1/analyses/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async delete(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
  ) {
    return this.analysisService.delete(user.id, id);
  }
}
