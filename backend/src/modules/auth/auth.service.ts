import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto, LoginDto } from './dto';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('An account with this email already exists');
    }

    // Hash password with bcrypt
    const passwordHash = await bcrypt.hash(dto.password, 12);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        name: dto.name.trim(),
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        createdAt: true,
      },
    });

    this.logger.log(`New user registered: ${user.email}`);

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email);

    return {
      user,
      ...tokens,
    };
  }

  async login(dto: LoginDto, userAgent?: string, ipAddress?: string) {
    const email = dto.email.toLowerCase().trim();

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Update last login timestamp
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    this.logger.log(`User logged in: ${user.email}`);

    // Generate tokens
    const tokens = await this.generateTokens(
      user.id,
      user.email,
      userAgent,
      ipAddress,
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      },
      ...tokens,
    };
  }

  async refreshTokens(refreshToken: string) {
    // Find the refresh token in database
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Check if token is expired
    if (storedToken.expiresAt < new Date()) {
      // Delete expired token
      await this.prisma.refreshToken.delete({
        where: { id: storedToken.id },
      });
      throw new UnauthorizedException('Refresh token has expired');
    }

    // Delete old token (token rotation for security)
    await this.prisma.refreshToken.delete({
      where: { id: storedToken.id },
    });

    // Generate new tokens
    const tokens = await this.generateTokens(
      storedToken.userId,
      storedToken.user.email,
      storedToken.userAgent || undefined,
      storedToken.ipAddress || undefined,
    );

    this.logger.log(`Tokens refreshed for user: ${storedToken.user.email}`);

    return tokens;
  }

  async logout(refreshToken: string) {
    // Delete the refresh token
    await this.prisma.refreshToken.deleteMany({
      where: { token: refreshToken },
    });

    return { success: true, message: 'Logged out successfully' };
  }

  async logoutAllDevices(userId: string) {
    // Delete all refresh tokens for this user
    const result = await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });

    this.logger.log(`All sessions terminated for user: ${userId}`);

    return {
      success: true,
      message: `Logged out from ${result.count} device(s)`,
      devicesLoggedOut: result.count,
    };
  }

  async getActiveSessions(userId: string) {
    const sessions = await this.prisma.refreshToken.findMany({
      where: {
        userId,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return sessions;
  }

  private async generateTokens(
    userId: string,
    email: string,
    userAgent?: string,
    ipAddress?: string,
  ) {
    // Generate access token (short-lived)
    const accessToken = this.jwtService.sign(
      {
        sub: userId,
        email,
      },
      {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'),
      },
    );

    // Generate refresh token (long-lived, stored in DB)
    const refreshToken = randomBytes(64).toString('hex');

    // Calculate expiry date
    const refreshExpiresIn = this.configService.get<string>(
      'JWT_REFRESH_EXPIRES_IN',
      '7d',
    );
    const expiresAt = this.calculateExpiry(refreshExpiresIn);

    // Store refresh token in database
    await this.prisma.refreshToken.create({
      data: {
        userId,
        token: refreshToken,
        expiresAt,
        userAgent,
        ipAddress,
      },
    });

    // Clean up expired tokens for this user (housekeeping)
    await this.prisma.refreshToken.deleteMany({
      where: {
        userId,
        expiresAt: { lt: new Date() },
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.getExpirySeconds(
        this.configService.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'),
      ),
    };
  }

  private calculateExpiry(duration: string): Date {
    const now = new Date();
    const value = parseInt(duration);
    const unit = duration.replace(/\d/g, '');

    switch (unit) {
      case 'm':
        now.setMinutes(now.getMinutes() + value);
        break;
      case 'h':
        now.setHours(now.getHours() + value);
        break;
      case 'd':
        now.setDate(now.getDate() + value);
        break;
      default:
        now.setDate(now.getDate() + 7); // Default 7 days
    }

    return now;
  }

  private getExpirySeconds(duration: string): number {
    const value = parseInt(duration);
    const unit = duration.replace(/\d/g, '');

    switch (unit) {
      case 'm':
        return value * 60;
      case 'h':
        return value * 60 * 60;
      case 'd':
        return value * 24 * 60 * 60;
      default:
        return 15 * 60; // Default 15 minutes
    }
  }
}
