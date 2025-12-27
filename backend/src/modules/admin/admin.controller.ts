import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { AdminService } from './admin.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ═══════════════════════════════════════════════════════════════
  // ANALYTICS & METRICS
  // ═══════════════════════════════════════════════════════════════

  @Get('analytics/overview')
  async getAnalyticsOverview() {
    return this.adminService.getAnalyticsOverview();
  }

  @Get('analytics/user-growth')
  async getUserGrowth(@Query('days') days?: string) {
    const dayCount = days ? parseInt(days, 10) : 30;
    return this.adminService.getUserGrowth(dayCount);
  }

  @Get('analytics/usage-stats')
  async getUsageStats(@Query('days') days?: string) {
    const dayCount = days ? parseInt(days, 10) : 30;
    return this.adminService.getUsageStats(dayCount);
  }

  @Get('analytics/popular-features')
  async getPopularFeatures() {
    return this.adminService.getPopularFeatures();
  }

  @Get('analytics/system-health')
  async getSystemHealth() {
    return this.adminService.getSystemHealth();
  }

  // ═══════════════════════════════════════════════════════════════
  // USER MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  @Get('users')
  async getAllUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('role') role?: UserRole,
    @Query('isActive') isActive?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    const activeFilter = isActive !== undefined ? isActive === 'true' : undefined;

    return this.adminService.getAllUsers({
      page: pageNum,
      limit: limitNum,
      search,
      role,
      isActive: activeFilter,
    });
  }

  @Get('users/:id')
  async getUserDetails(@Param('id') id: string) {
    return this.adminService.getUserDetails(id);
  }

  @Patch('users/:id')
  @HttpCode(HttpStatus.OK)
  async updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.adminService.updateUser(id, dto);
  }

  @Patch('users/:id/suspend')
  @HttpCode(HttpStatus.OK)
  async suspendUser(@Param('id') id: string) {
    return this.adminService.suspendUser(id);
  }

  @Patch('users/:id/activate')
  @HttpCode(HttpStatus.OK)
  async activateUser(@Param('id') id: string) {
    return this.adminService.activateUser(id);
  }

  @Get('users/:id/activity')
  async getUserActivity(@Param('id') id: string, @Query('days') days?: string) {
    const dayCount = days ? parseInt(days, 10) : 30;
    return this.adminService.getUserActivity(id, dayCount);
  }

  // ═══════════════════════════════════════════════════════════════
  // ANALYSIS MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  @Get('analyses/recent')
  async getRecentAnalyses(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 50;
    return this.adminService.getRecentAnalyses(limitNum);
  }

  @Get('analyses/failed')
  async getFailedAnalyses(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 50;
    return this.adminService.getFailedAnalyses(limitNum);
  }
}
