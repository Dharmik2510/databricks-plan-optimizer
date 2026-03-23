import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

// Mock google-auth-library OAuth2Client
jest.mock('google-auth-library', () => {
    return {
        OAuth2Client: jest.fn().mockImplementation(() => ({
            verifyIdToken: jest.fn(),
        })),
    };
});

const mockUser = {
    id: 'user-id-123',
    email: 'test@example.com',
    name: 'Test User',
    avatar: null,
    passwordHash: 'hashed-password',
    googleId: null,
    isVerified: true,
    isActive: true,
    role: 'USER',
    resetToken: null,
    resetTokenExpiry: null,
    verificationToken: null,
    lastLoginAt: new Date(),
    createdAt: new Date(),
    settings: {},
    analysisCount: 0,
};

const mockRefreshToken = {
    id: 'token-id-1',
    userId: mockUser.id,
    token: 'valid-refresh-token',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    userAgent: 'test-agent',
    ipAddress: '127.0.0.1',
    createdAt: new Date(),
    user: mockUser,
};

describe('AuthService', () => {
    let service: AuthService;
    let prisma: jest.Mocked<PrismaService>;
    let jwtService: jest.Mocked<JwtService>;
    let configService: jest.Mocked<ConfigService>;
    let emailService: jest.Mocked<EmailService>;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                {
                    provide: PrismaService,
                    useValue: {
                        user: {
                            findUnique: jest.fn(),
                            findFirst: jest.fn(),
                            create: jest.fn(),
                            update: jest.fn(),
                        },
                        refreshToken: {
                            create: jest.fn(),
                            findUnique: jest.fn(),
                            delete: jest.fn(),
                            deleteMany: jest.fn(),
                            findMany: jest.fn(),
                        },
                    },
                },
                {
                    provide: JwtService,
                    useValue: {
                        sign: jest.fn().mockReturnValue('signed-jwt-token'),
                    },
                },
                {
                    provide: ConfigService,
                    useValue: {
                        get: jest.fn().mockImplementation((key: string, defaultValue?: string) => {
                            const config: Record<string, string> = {
                                JWT_SECRET: 'test-secret',
                                JWT_ACCESS_EXPIRES_IN: '15m',
                                JWT_REFRESH_EXPIRES_IN: '7d',
                                GOOGLE_CLIENT_ID: 'test-google-client-id',
                            };
                            return config[key] ?? defaultValue;
                        }),
                    },
                },
                {
                    provide: EmailService,
                    useValue: {
                        sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
                        sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
                    },
                },
            ],
        }).compile();

        service = module.get<AuthService>(AuthService);
        prisma = module.get(PrismaService);
        jwtService = module.get(JwtService);
        configService = module.get(ConfigService);
        emailService = module.get(EmailService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    // -----------------------------------------------------------------------
    // register
    // -----------------------------------------------------------------------
    describe('register', () => {
        const registerDto = { email: 'New@Example.com', name: 'New User', password: 'Password123!' };

        beforeEach(() => {
            (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
            (prisma.user.create as jest.Mock).mockResolvedValue({
                ...mockUser,
                email: 'new@example.com',
                name: 'New User',
            });
            (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});
            (prisma.refreshToken.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
        });

        it('should register a new user and return tokens', async () => {
            const result = await service.register(registerDto);

            expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'new@example.com' } });
            expect(prisma.user.create).toHaveBeenCalled();
            expect(result).toHaveProperty('accessToken');
            expect(result).toHaveProperty('refreshToken');
            expect(result).toHaveProperty('user');
            expect(result.message).toContain('Registration successful');
        });

        it('should normalise the email to lowercase before checking for duplicates', async () => {
            await service.register(registerDto);
            expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'new@example.com' } });
        });

        it('should throw ConflictException when user already exists', async () => {
            (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
            await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
        });

        it('should send a verification email after registration', async () => {
            await service.register(registerDto);
            expect(emailService.sendVerificationEmail).toHaveBeenCalled();
        });

        it('should hash the password with bcrypt before persisting', async () => {
            const hashSpy = jest.spyOn(bcrypt, 'hash');
            await service.register(registerDto);
            expect(hashSpy).toHaveBeenCalledWith(registerDto.password, 12);
        });
    });

    // -----------------------------------------------------------------------
    // login
    // -----------------------------------------------------------------------
    describe('login', () => {
        const loginDto = { email: 'Test@Example.com', password: 'Password123!' };

        beforeEach(() => {
            (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
            (prisma.user.update as jest.Mock).mockResolvedValue(mockUser);
            (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});
            (prisma.refreshToken.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
            jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true as never));
        });

        it('should return tokens on successful login', async () => {
            const result = await service.login(loginDto);

            expect(result).toHaveProperty('accessToken');
            expect(result).toHaveProperty('refreshToken');
            expect(result.user.email).toBe(mockUser.email);
        });

        it('should normalise the email before lookup', async () => {
            await service.login(loginDto);
            expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'test@example.com' } });
        });

        it('should throw UnauthorizedException for unknown user', async () => {
            (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
            await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
        });

        it('should throw UnauthorizedException for invalid password', async () => {
            jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(false as never));
            await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
        });
    });

    // -----------------------------------------------------------------------
    // loginWithGoogle (OAuth token flow)
    // -----------------------------------------------------------------------
    describe('loginWithGoogle', () => {
        const { OAuth2Client } = require('google-auth-library');
        const mockVerifyIdToken = jest.fn();

        beforeEach(() => {
            OAuth2Client.mockImplementation(() => ({ verifyIdToken: mockVerifyIdToken }));

            mockVerifyIdToken.mockResolvedValue({
                getPayload: () => ({
                    email: 'google@example.com',
                    name: 'Google User',
                    picture: 'https://example.com/pic.jpg',
                    sub: 'google-sub-id',
                }),
            });

            (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
            (prisma.user.create as jest.Mock).mockResolvedValue({
                ...mockUser,
                email: 'google@example.com',
                name: 'Google User',
                googleId: 'google-sub-id',
                isVerified: true,
            });
            (prisma.user.update as jest.Mock).mockResolvedValue(mockUser);
            (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});
            (prisma.refreshToken.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
        });

        it('should initialise an OAuth2Client and verify the id token', async () => {
            await service.loginWithGoogle('google-id-token');
            expect(mockVerifyIdToken).toHaveBeenCalledWith({
                idToken: 'google-id-token',
                audience: 'test-google-client-id',
            });
        });

        it('should create a new user on first Google login', async () => {
            const result = await service.loginWithGoogle('google-id-token');

            expect(prisma.user.create).toHaveBeenCalled();
            expect(result).toHaveProperty('accessToken');
            expect(result).toHaveProperty('refreshToken');
            expect(result.user.email).toBe('google@example.com');
        });

        it('should link the Google ID to an existing account', async () => {
            (prisma.user.findUnique as jest.Mock).mockResolvedValue({ ...mockUser, googleId: null });
            (prisma.user.update as jest.Mock).mockResolvedValue({ ...mockUser, googleId: 'google-sub-id' });

            const result = await service.loginWithGoogle('google-id-token');

            expect(prisma.user.update).toHaveBeenCalledWith(
                expect.objectContaining({ data: expect.objectContaining({ googleId: 'google-sub-id' }) }),
            );
            expect(result).toHaveProperty('accessToken');
        });

        it('should skip linking when Google ID is already set', async () => {
            (prisma.user.findUnique as jest.Mock).mockResolvedValue({
                ...mockUser,
                googleId: 'google-sub-id',
            });

            await service.loginWithGoogle('google-id-token');

            // update should only be called for lastLoginAt, not for linking
            const updateCalls = (prisma.user.update as jest.Mock).mock.calls;
            const linkingCall = updateCalls.find(
                ([args]: [any]) => args.data && 'googleId' in args.data,
            );
            expect(linkingCall).toBeUndefined();
        });

        it('should throw UnauthorizedException when the OAuth token is invalid', async () => {
            mockVerifyIdToken.mockRejectedValue(new Error('Token verification failed'));
            await expect(service.loginWithGoogle('bad-token')).rejects.toThrow(UnauthorizedException);
        });

        it('should throw UnauthorizedException when the payload has no email', async () => {
            mockVerifyIdToken.mockResolvedValue({
                getPayload: () => ({ sub: 'google-sub-id' }),
            });
            await expect(service.loginWithGoogle('no-email-token')).rejects.toThrow(UnauthorizedException);
        });
    });

    // -----------------------------------------------------------------------
    // refreshTokens
    // -----------------------------------------------------------------------
    describe('refreshTokens', () => {
        it('should return new tokens for a valid refresh token', async () => {
            (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(mockRefreshToken);
            (prisma.refreshToken.delete as jest.Mock).mockResolvedValue({});
            (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});
            (prisma.refreshToken.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });

            const result = await service.refreshTokens('valid-refresh-token');
            expect(result).toHaveProperty('accessToken');
            expect(result).toHaveProperty('refreshToken');
        });

        it('should delete the old token before issuing a new one (token rotation)', async () => {
            (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(mockRefreshToken);
            (prisma.refreshToken.delete as jest.Mock).mockResolvedValue({});
            (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});
            (prisma.refreshToken.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });

            await service.refreshTokens('valid-refresh-token');

            expect(prisma.refreshToken.delete).toHaveBeenCalledWith({ where: { id: mockRefreshToken.id } });
            expect(prisma.refreshToken.create).toHaveBeenCalledWith(
                expect.objectContaining({ data: expect.objectContaining({ userId: mockUser.id }) }),
            );
        });

        it('should throw UnauthorizedException for an unknown refresh token', async () => {
            (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(null);
            await expect(service.refreshTokens('unknown-token')).rejects.toThrow(UnauthorizedException);
        });

        it('should throw UnauthorizedException for an expired refresh token', async () => {
            (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
                ...mockRefreshToken,
                expiresAt: new Date(Date.now() - 1000),
            });
            (prisma.refreshToken.delete as jest.Mock).mockResolvedValue({});
            await expect(service.refreshTokens('expired-token')).rejects.toThrow(UnauthorizedException);
        });
    });

    // -----------------------------------------------------------------------
    // logout
    // -----------------------------------------------------------------------
    describe('logout', () => {
        it('should delete the refresh token and return success', async () => {
            (prisma.refreshToken.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });

            const result = await service.logout('some-refresh-token');
            expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
                where: { token: 'some-refresh-token' },
            });
            expect(result.success).toBe(true);
        });
    });

    // -----------------------------------------------------------------------
    // forgotPassword
    // -----------------------------------------------------------------------
    describe('forgotPassword', () => {
        it('should send a reset email when the user exists', async () => {
            (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
            (prisma.user.update as jest.Mock).mockResolvedValue(mockUser);

            const result = await service.forgotPassword({ email: 'test@example.com' });
            expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(
                'test@example.com',
                expect.any(String),
            );
            expect(result.success).toBe(true);
        });

        it('should return success without revealing user existence when user is not found', async () => {
            (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

            const result = await service.forgotPassword({ email: 'unknown@example.com' });
            expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
            expect(result.success).toBe(true);
        });
    });

    // -----------------------------------------------------------------------
    // verifyEmail
    // -----------------------------------------------------------------------
    describe('verifyEmail', () => {
        it('should verify the email for a valid token', async () => {
            (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockUser);
            (prisma.user.update as jest.Mock).mockResolvedValue({ ...mockUser, isVerified: true });

            const result = await service.verifyEmail('valid-token');
            expect(result.success).toBe(true);
        });

        it('should throw UnauthorizedException for an invalid token', async () => {
            (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
            await expect(service.verifyEmail('bad-token')).rejects.toThrow(UnauthorizedException);
        });
    });
});
