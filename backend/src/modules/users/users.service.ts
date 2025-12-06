import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateUserDto, ChangePasswordDto } from './dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        settings: true,
        analysisCount: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async update(userId: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.avatar !== undefined && { avatar: dto.avatar }),
        ...(dto.settings && { settings: dto.settings }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        settings: true,
        updatedAt: true,
      },
    });

    return user;
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    // Get current user with password
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );

    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Check if new password is different from current
    const isSamePassword = await bcrypt.compare(
      dto.newPassword,
      user.passwordHash,
    );

    if (isSamePassword) {
      throw new BadRequestException(
        'New password must be different from current password',
      );
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(dto.newPassword, 12);

    // Update password
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    // Optionally: Invalidate all refresh tokens (force re-login on all devices)
    await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });

    return {
      success: true,
      message: 'Password changed successfully. Please log in again.',
    };
  }

  async deleteAccount(userId: string) {
    // This will cascade delete all related data (analyses, chat sessions, etc.)
    await this.prisma.user.delete({
      where: { id: userId },
    });

    return {
      success: true,
      message: 'Account deleted successfully',
    };
  }

  async getStats(userId: string) {
    const [analysisCount, chatSessionCount, totalMessages] = await Promise.all([
      this.prisma.analysis.count({ where: { userId } }),
      this.prisma.chatSession.count({ where: { userId } }),
      this.prisma.chatMessage.count({
        where: { session: { userId } },
      }),
    ]);

    const recentAnalyses = await this.prisma.analysis.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        title: true,
        status: true,
        severity: true,
        createdAt: true,
      },
    });

    return {
      analysisCount,
      chatSessionCount,
      totalMessages,
      recentAnalyses,
    };
  }
}
