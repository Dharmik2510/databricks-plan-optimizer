import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { setRequestContextUser } from '../../common/middleware/request-context.middleware';

export interface JwtPayload {
  sub: string; // User ID
  email: string;
  iat?: number;
  exp?: number;
}

/**
 * JWT Authentication Strategy with session tracking
 * - Validates JWT tokens
 * - Loads user from database
 * - Sets user context for request
 * - Tracks user sessions for observability
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
      // Pass request to validate() method for session tracking
      passReqToCallback: true,
    });
  }

  async validate(request: any, payload: JwtPayload) {
    // Load user from database
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        isActive: true,
        settings: true,
        analysisCount: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found or token invalid');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is deactivated');
    }

    // Set user in request context for logging
    setRequestContextUser(user.id);

    // Track or update user session
    await this.trackSession(request, user.id);

    return user;
  }

  /**
   * Track or update user session for observability
   * - Creates new session if sessionId is provided
   * - Updates lastActivityAt for existing sessions
   * - Gracefully handles failures (doesn't block authentication)
   */
  private async trackSession(request: any, userId: string): Promise<void> {
    const sessionId = request.headers['x-session-id'] as string;

    if (!sessionId) {
      // No session ID provided, skip session tracking
      return;
    }

    try {
      const deviceInfo = {
        userAgent: request.headers['user-agent'],
        acceptLanguage: request.headers['accept-language'],
      };

      const ipAddress = request.ip || request.connection.remoteAddress;

      // Upsert session (create if new, update if exists)
      await this.prisma.userSession.upsert({
        where: { sessionId },
        create: {
          sessionId,
          userId,
          deviceInfo,
          ipAddress,
          userAgent: request.headers['user-agent'],
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        },
        update: {
          lastActivityAt: new Date(),
        },
      });
    } catch (error) {
      // CRITICAL: Never fail authentication if session tracking fails
      // Log error but continue (session tracking is for observability, not security)
      console.error('Failed to track session:', error);
    }
  }
}
