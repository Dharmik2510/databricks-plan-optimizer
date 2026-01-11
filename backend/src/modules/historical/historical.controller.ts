import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser, CurrentUserData } from '../../common/decorators';
import { HistoricalService } from './historical.service';
import { AnalyzeHistoricalDto, CompareHistoricalDto, HistoricalRunSummary, HistoryQueryDto, RunsQueryDto, UpdateHistoricalDto } from './dto';
import { HistoricalRateLimitGuard } from './historical-rate-limit.guard';
import { setRequestContextFeature } from '../../common/middleware/request-context.middleware';

@Controller('historical')
@UseGuards(JwtAuthGuard)
export class HistoricalController {
  constructor(private readonly historicalService: HistoricalService) {}

  @Post('analyze')
  @UseGuards(HistoricalRateLimitGuard)
  async analyze(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: AnalyzeHistoricalDto,
  ) {
    setRequestContextFeature('historical');
    return this.historicalService.analyze(user.id, user.orgId, dto, user.role);
  }

  @Post('compare')
  @UseGuards(HistoricalRateLimitGuard)
  async compare(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CompareHistoricalDto,
  ) {
    setRequestContextFeature('historical');
    return this.historicalService.compare(user.id, user.orgId, dto);
  }

  @Get('history')
  async history(
    @CurrentUser() user: CurrentUserData,
    @Query() query: HistoryQueryDto,
  ) {
    setRequestContextFeature('historical');
    return this.historicalService.getHistory(user.id, query);
  }

  @Get('runs')
  async runs(
    @CurrentUser() user: CurrentUserData,
    @Query() query: RunsQueryDto,
  ): Promise<HistoricalRunSummary[]> {
    setRequestContextFeature('historical');
    return this.historicalService.listRuns(user.id, user.orgId, query, user.role);
  }

  @Get(':id')
  async getById(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
  ) {
    setRequestContextFeature('historical');
    return this.historicalService.getById(user.id, id);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
    @Body() dto: UpdateHistoricalDto,
  ) {
    setRequestContextFeature('historical');
    return this.historicalService.updateAnalysis(user.id, id, dto);
  }
}
