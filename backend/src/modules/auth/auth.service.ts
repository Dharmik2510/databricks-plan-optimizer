import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto, LoginDto, ForgotPasswordDto, ResetPasswordDto } from './dto';
import { EmailService } from '../email/email.service';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { resolveOrgIdFromSettings } from '../../common/tenancy/tenancy.utils';
import { UserRole } from '@prisma/client';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
  ) { }

  async forgotPassword(dto: ForgotPasswordDto) {
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Don't reveal user existence
      return { success: true, message: 'If an account exists, a reset email has been sent.' };
    }

    // Generate reset token
    const token = randomBytes(32).toString('hex');
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + 1); // 1 hour expiry

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: token,
        resetTokenExpiry: expiry,
      },
    });

    // Send email
    await this.emailService.sendPasswordResetEmail(email, token);

    return { success: true, message: 'If an account exists, a reset email has been sent.' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        resetToken: dto.token,
        resetTokenExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid or expired password reset token');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    return { success: true, message: 'Password has been reset successfully' };
  }

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

    // Generate verification token
    const verificationToken = randomBytes(32).toString('hex');

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        name: dto.name.trim(),
        verificationToken,
        isVerified: false,
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

    // Send verification email
    try {
      await this.emailService.sendVerificationEmail(user.email, verificationToken);
    } catch (error) {
      this.logger.error(`Failed to send verification email to ${user.email}`);
      // Continue anyway, user can request resend later (if we implemented that)
    }

    // Generate tokens
    const orgId = resolveOrgIdFromSettings(undefined, user.id) || undefined;
    const tokens = await this.generateTokens({
      userId: user.id,
      email: user.email,
      orgId,
      role: UserRole.USER,
    });

    return {
      user,
      ...tokens,
      message: 'Registration successful. Please check your email to verify your account.',
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
    const orgId = resolveOrgIdFromSettings(user.settings, user.id) || undefined;
    const tokens = await this.generateTokens({
      userId: user.id,
      email: user.email,
      orgId,
      role: user.role,
      userAgent,
      ipAddress,
    });

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

  async loginWithGoogle(idToken: string, userAgent?: string, ipAddress?: string) {
    const client = new OAuth2Client(
      this.configService.get<string>('GOOGLE_CLIENT_ID'),
    );

    try {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: this.configService.get<string>('GOOGLE_CLIENT_ID'),
      });
      const payload = ticket.getPayload();

      if (!payload || !payload.email) {
        throw new UnauthorizedException('Invalid Google token');
      }

      const { email, name, picture, sub: googleId } = payload;

      // Find or create user
      let user = await this.prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        // Create new user
        // Generate random password as placeholder
        const randomPassword = randomBytes(16).toString('hex');
        const passwordHash = await bcrypt.hash(randomPassword, 12);

        user = await this.prisma.user.create({
          data: {
            email,
            name: name || 'Google User',
            avatar: picture,
            googleId,
            isVerified: true, // Google emails are verified
            passwordHash,
          },
        });
        this.logger.log(`New user registered via Google: ${email}`);
      } else {
        // Link Google ID if not present
        if (!user.googleId) {
          user = await this.prisma.user.update({
            where: { id: user.id },
            data: { googleId, isVerified: true, avatar: user.avatar || picture },
          });
        }

        // Update last login
        await this.prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });
      }

      // Generate tokens
      const orgId = resolveOrgIdFromSettings(user.settings, user.id) || undefined;
      const tokens = await this.generateTokens({
        userId: user.id,
        email: user.email,
        orgId,
        role: user.role,
        userAgent,
        ipAddress,
      });

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
        },
        ...tokens,
      };

    } catch (error) {
      this.logger.error(`Google login failed: ${error.message}`);
      throw new UnauthorizedException('Google authentication failed');
    }
  }

  async verifyEmail(token: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        verificationToken: token,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid verification token');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        verificationToken: null,
      },
    });

    return { success: true, message: 'Email verified successfully' };
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
    const orgId = resolveOrgIdFromSettings(storedToken.user.settings, storedToken.userId) || undefined;
    const tokens = await this.generateTokens({
      userId: storedToken.userId,
      email: storedToken.user.email,
      orgId,
      role: storedToken.user.role,
      userAgent: storedToken.userAgent || undefined,
      ipAddress: storedToken.ipAddress || undefined,
    });

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

  private async generateTokens(params: {
    userId: string;
    email: string;
    orgId?: string;
    role?: UserRole;
    userAgent?: string;
    ipAddress?: string;
  }) {
    const { userId, email, orgId, role, userAgent, ipAddress } = params;
    // Generate access token (short-lived)
    const accessToken = this.jwtService.sign(
      {
        sub: userId,
        email,
        org_id: orgId,
        role,
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
