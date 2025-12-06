import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto, ChangePasswordDto } from './dto';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser, CurrentUserData } from '../../common/decorators';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Get current user profile
   * GET /api/v1/users/me
   */
  @Get('me')
  async getProfile(@CurrentUser() user: CurrentUserData) {
    return this.usersService.findById(user.id);
  }

  /**
   * Update current user profile
   * PATCH /api/v1/users/me
   */
  @Patch('me')
  async updateProfile(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(user.id, dto);
  }

  /**
   * Change password
   * PATCH /api/v1/users/me/password
   */
  @Patch('me/password')
  async changePassword(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(user.id, dto);
  }

  /**
   * Get user statistics
   * GET /api/v1/users/me/stats
   */
  @Get('me/stats')
  async getStats(@CurrentUser() user: CurrentUserData) {
    return this.usersService.getStats(user.id);
  }

  /**
   * Delete account
   * DELETE /api/v1/users/me
   */
  @Delete('me')
  @HttpCode(HttpStatus.OK)
  async deleteAccount(@CurrentUser() user: CurrentUserData) {
    return this.usersService.deleteAccount(user.id);
  }
}
