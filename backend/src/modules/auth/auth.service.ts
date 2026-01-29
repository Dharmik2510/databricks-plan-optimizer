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

    try {
      this.logger.log('Starting forgot password flow', {
        email,
      });

      const user = await this.prisma.user.findUnique({ where: { email } });

      if (!user) {
        // Don't reveal user existence
        this.logger.log('Forgot password requested for non-existent email', {
          email,
        });
        return { success: true, message: 'If an account exists, a reset email has been sent.' };
      }

      this.logger.log('User found, generating reset token', {
        userId: user.id,
        email,
      });

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

      this.logger.log('Reset token stored in database', {
        userId: user.id,
        tokenExpiry: expiry,
      });

      // Send email
      try {
        await this.emailService.sendPasswordResetEmail(email, token);
        this.logger.log('Password reset email sent successfully', {
          email,
        });
      } catch (emailError) {
        this.logger.error('Failed to send password reset email', {
          email,
          error: emailError instanceof Error ? emailError.message : String(emailError),
          stack: emailError instanceof Error ? emailError.stack : undefined,
        });
        // Continue anyway, token is stored
      }

      this.logger.log('✅ Forgot password flow completed successfully', {
        email,
      });

      return { success: true, message: 'If an account exists, a reset email has been sent.' };
    } catch (error) {
      this.logger.error('❌ Forgot password flow failed', {
        email,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  async resetPassword(dto: ResetPasswordDto) {
    try {
      this.logger.log('Starting password reset', {
        tokenProvided: !!dto.token,
      });

      const user = await this.prisma.user.findFirst({
        where: {
          resetToken: dto.token,
          resetTokenExpiry: { gt: new Date() },
        },
      });

      if (!user) {
        this.logger.warn('Password reset attempted with invalid or expired token', {
          tokenProvided: !!dto.token,
        });
        throw new UnauthorizedException('Invalid or expired password reset token');
      }

      this.logger.log('Valid reset token found, hashing new password', {
        userId: user.id,
        email: user.email,
      });

      const passwordHash = await bcrypt.hash(dto.newPassword, 12);

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          resetToken: null,
          resetTokenExpiry: null,
        },
      });

      this.logger.log('✅ Password reset completed successfully', {
        userId: user.id,
        email: user.email,
      });

      return { success: true, message: 'Password has been reset successfully' };
    } catch (error) {
      this.logger.error('❌ Password reset failed', {
        tokenProvided: !!dto.token,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase().trim();

    try {
      this.logger.log('Starting user registration', {
        email,
        name: dto.name,
      });

      // Check if user already exists
      const existingUser = await this.prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        this.logger.warn('Registration attempted with existing email', {
          email,
        });
        throw new ConflictException('An account with this email already exists');
      }

      this.logger.log('Email available, hashing password', {
        email,
      });

      // Hash password with bcrypt
      const passwordHash = await bcrypt.hash(dto.password, 12);

      // Generate verification token
      const verificationToken = randomBytes(32).toString('hex');

      this.logger.log('Creating new user record', {
        email,
      });

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

      this.logger.log('User record created successfully', {
        userId: user.id,
        email: user.email,
      });

      // Send verification email
      try {
        await this.emailService.sendVerificationEmail(user.email, verificationToken);
        this.logger.log('Verification email sent successfully', {
          email: user.email,
        });
      } catch (emailError) {
        this.logger.error('Failed to send verification email', {
          email: user.email,
          error: emailError instanceof Error ? emailError.message : String(emailError),
          stack: emailError instanceof Error ? emailError.stack : undefined,
        });
        // Continue anyway, user can request resend later (if we implemented that)
      }

      this.logger.log('Generating authentication tokens', {
        userId: user.id,
      });

      // Generate tokens
      const orgId = resolveOrgIdFromSettings(undefined, user.id) || undefined;
      const tokens = await this.generateTokens({
        userId: user.id,
        email: user.email,
        orgId,
        role: UserRole.USER,
      });

      this.logger.log('✅ User registration completed successfully', {
        userId: user.id,
        email: user.email,
      });

      return {
        user,
        ...tokens,
        message: 'Registration successful. Please check your email to verify your account.',
      };
    } catch (error) {
      this.logger.error('❌ User registration failed', {
        email,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  async login(dto: LoginDto, userAgent?: string, ipAddress?: string) {
    const email = dto.email.toLowerCase().trim();

    try {
      this.logger.log('Starting login attempt', {
        email,
        userAgent: userAgent || 'unknown',
        ipAddress: ipAddress || 'unknown',
      });

      // Find user
      const user = await this.prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        this.logger.warn('Login failed: user not found', {
          email,
        });
        throw new UnauthorizedException('Invalid email or password');
      }

      this.logger.log('User found, verifying password', {
        userId: user.id,
        email,
      });

      // Verify password
      const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);

      if (!isPasswordValid) {
        this.logger.warn('Login failed: invalid password', {
          userId: user.id,
          email,
        });
        throw new UnauthorizedException('Invalid email or password');
      }

      this.logger.log('Password verified, updating last login timestamp', {
        userId: user.id,
      });

      // Update last login timestamp
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      this.logger.log('Generating authentication tokens', {
        userId: user.id,
      });

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

      this.logger.log('✅ User logged in successfully', {
        userId: user.id,
        email: user.email,
        userAgent: userAgent || 'unknown',
        ipAddress: ipAddress || 'unknown',
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
      this.logger.error('❌ Login failed', {
        email,
        userAgent: userAgent || 'unknown',
        ipAddress: ipAddress || 'unknown',
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  async loginWithGoogle(idToken: string, userAgent?: string, ipAddress?: string) {
    try {
      this.logger.log('Starting Google OAuth login', {
        idToken: '***REDACTED***',
        userAgent: userAgent || 'unknown',
        ipAddress: ipAddress || 'unknown',
      });

      const client = new OAuth2Client(
        this.configService.get<string>('GOOGLE_CLIENT_ID'),
      );

      this.logger.log('Verifying Google ID token', {
        clientId: this.configService.get<string>('GOOGLE_CLIENT_ID') ? '***SET***' : '***NOT_SET***',
      });

      const ticket = await client.verifyIdToken({
        idToken,
        audience: this.configService.get<string>('GOOGLE_CLIENT_ID'),
      });
      const payload = ticket.getPayload();

      if (!payload || !payload.email) {
        this.logger.warn('Google token verification failed: invalid payload', {
          hasPayload: !!payload,
          hasEmail: payload?.email ? true : false,
        });
        throw new UnauthorizedException('Invalid Google token');
      }

      const { email, name, picture, sub: googleId } = payload;

      this.logger.log('Google token verified successfully', {
        email,
        googleId,
      });

      // Find or create user
      let user = await this.prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        this.logger.log('User not found, creating new account via Google OAuth', {
          email,
          googleId,
        });

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

        this.logger.log('New user created via Google OAuth', {
          userId: user.id,
          email,
          googleId,
        });
      } else {
        this.logger.log('Existing user found', {
          userId: user.id,
          email,
          hasGoogleId: !!user.googleId,
        });

        // Link Google ID if not present
        if (!user.googleId) {
          this.logger.log('Linking Google ID to existing account', {
            userId: user.id,
          });

          user = await this.prisma.user.update({
            where: { id: user.id },
            data: { googleId, isVerified: true, avatar: user.avatar || picture },
          });

          this.logger.log('Google ID linked successfully', {
            userId: user.id,
            googleId,
          });
        }

        // Update last login
        await this.prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        this.logger.log('Last login timestamp updated', {
          userId: user.id,
        });
      }

      this.logger.log('Generating authentication tokens', {
        userId: user.id,
      });

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

      this.logger.log('✅ Google OAuth login completed successfully', {
        userId: user.id,
        email: user.email,
        isNewUser: !user.createdAt ||
          (new Date().getTime() - new Date(user.createdAt).getTime()) < 5000,
        userAgent: userAgent || 'unknown',
        ipAddress: ipAddress || 'unknown',
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
      this.logger.error('❌ Google OAuth login failed', {
        idToken: '***REDACTED***',
        userAgent: userAgent || 'unknown',
        ipAddress: ipAddress || 'unknown',
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw new UnauthorizedException('Google authentication failed');
    }
  }

  async verifyEmail(token: string) {
    try {
      this.logger.log('Starting email verification', {
        tokenProvided: !!token,
      });

      const user = await this.prisma.user.findFirst({
        where: {
          verificationToken: token,
        },
      });

      if (!user) {
        this.logger.warn('Email verification attempted with invalid token', {
          tokenProvided: !!token,
        });
        throw new UnauthorizedException('Invalid verification token');
      }

      this.logger.log('Valid verification token found, updating user', {
        userId: user.id,
        email: user.email,
      });

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          isVerified: true,
          verificationToken: null,
        },
      });

      this.logger.log('✅ Email verified successfully', {
        userId: user.id,
        email: user.email,
      });

      return { success: true, message: 'Email verified successfully' };
    } catch (error) {
      this.logger.error('❌ Email verification failed', {
        tokenProvided: !!token,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  async refreshTokens(refreshToken: string) {
    try {
      this.logger.log('Starting token refresh', {
        refreshToken: '***REDACTED***',
      });

      // Find the refresh token in database
      const storedToken = await this.prisma.refreshToken.findUnique({
        where: { token: refreshToken },
        include: { user: true },
      });

      if (!storedToken) {
        this.logger.warn('Token refresh failed: invalid refresh token', {
          refreshToken: '***REDACTED***',
        });
        throw new UnauthorizedException('Invalid refresh token');
      }

      this.logger.log('Refresh token found in database', {
        userId: storedToken.userId,
        tokenId: storedToken.id,
        expiresAt: storedToken.expiresAt,
      });

      // Check if token is expired
      if (storedToken.expiresAt < new Date()) {
        this.logger.warn('Token refresh failed: token expired', {
          userId: storedToken.userId,
          tokenId: storedToken.id,
          expiresAt: storedToken.expiresAt,
        });

        // Delete expired token
        await this.prisma.refreshToken.delete({
          where: { id: storedToken.id },
        });

        this.logger.log('Expired token deleted from database', {
          tokenId: storedToken.id,
        });

        throw new UnauthorizedException('Refresh token has expired');
      }

      this.logger.log('Token is valid, performing token rotation', {
        userId: storedToken.userId,
        email: storedToken.user.email,
      });

      // Delete old token (token rotation for security)
      await this.prisma.refreshToken.delete({
        where: { id: storedToken.id },
      });

      this.logger.log('Old refresh token deleted, generating new tokens', {
        userId: storedToken.userId,
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

      this.logger.log('✅ Tokens refreshed successfully', {
        userId: storedToken.userId,
        email: storedToken.user.email,
      });

      return tokens;
    } catch (error) {
      this.logger.error('❌ Token refresh failed', {
        refreshToken: '***REDACTED***',
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  async logout(refreshToken: string) {
    try {
      this.logger.log('Starting logout', {
        refreshToken: '***REDACTED***',
      });

      // Delete the refresh token
      const result = await this.prisma.refreshToken.deleteMany({
        where: { token: refreshToken },
      });

      this.logger.log('✅ Logout completed successfully', {
        tokensDeleted: result.count,
      });

      return { success: true, message: 'Logged out successfully' };
    } catch (error) {
      this.logger.error('❌ Logout failed', {
        refreshToken: '***REDACTED***',
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  async logoutAllDevices(userId: string) {
    try {
      this.logger.log('Starting logout from all devices', {
        userId,
      });

      // Delete all refresh tokens for this user
      const result = await this.prisma.refreshToken.deleteMany({
        where: { userId },
      });

      this.logger.log('✅ All sessions terminated successfully', {
        userId,
        devicesLoggedOut: result.count,
      });

      return {
        success: true,
        message: `Logged out from ${result.count} device(s)`,
        devicesLoggedOut: result.count,
      };
    } catch (error) {
      this.logger.error('❌ Logout from all devices failed', {
        userId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  async getActiveSessions(userId: string) {
    try {
      this.logger.log('Fetching active sessions', {
        userId,
      });

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

      this.logger.log('✅ Active sessions retrieved successfully', {
        userId,
        sessionCount: sessions.length,
      });

      return sessions;
    } catch (error) {
      this.logger.error('❌ Failed to fetch active sessions', {
        userId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
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

    try {
      this.logger.log('Generating tokens', {
        userId,
        email,
        orgId: orgId || 'none',
        role: role || 'none',
        userAgent: userAgent || 'unknown',
        ipAddress: ipAddress || 'unknown',
      });

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

      this.logger.log('Access token generated', {
        userId,
        expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'),
      });

      // Generate refresh token (long-lived, stored in DB)
      const refreshToken = randomBytes(64).toString('hex');

      // Calculate expiry date
      const refreshExpiresIn = this.configService.get<string>(
        'JWT_REFRESH_EXPIRES_IN',
        '7d',
      );
      const expiresAt = this.calculateExpiry(refreshExpiresIn);

      this.logger.log('Storing refresh token in database', {
        userId,
        expiresAt,
      });

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

      this.logger.log('Refresh token stored successfully', {
        userId,
      });

      // Clean up expired tokens for this user (housekeeping)
      const cleanupResult = await this.prisma.refreshToken.deleteMany({
        where: {
          userId,
          expiresAt: { lt: new Date() },
        },
      });

      if (cleanupResult.count > 0) {
        this.logger.log('Expired tokens cleaned up', {
          userId,
          expiredTokensDeleted: cleanupResult.count,
        });
      }

      this.logger.log('✅ Tokens generated successfully', {
        userId,
        accessTokenGenerated: true,
        refreshTokenGenerated: true,
      });

      return {
        accessToken,
        refreshToken,
        expiresIn: this.getExpirySeconds(
          this.configService.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'),
        ),
      };
    } catch (error) {
      this.logger.error('❌ Token generation failed', {
        userId,
        email,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
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
