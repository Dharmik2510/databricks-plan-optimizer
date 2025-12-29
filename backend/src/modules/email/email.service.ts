
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
    private transporter: nodemailer.Transporter;
    private readonly logger = new Logger(EmailService.name);

    constructor(private configService: ConfigService) {
        this.transporter = nodemailer.createTransport({
            host: this.configService.get<string>('SMTP_HOST'),
            port: this.configService.get<number>('SMTP_PORT', 587),
            secure: false, // true for 465, false for other ports
            auth: {
                user: this.configService.get<string>('SMTP_USER'),
                pass: this.configService.get<string>('SMTP_PASS'),
            },
        });
    }

    async sendPasswordResetEmail(email: string, token: string) {
        const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000').replace(/\/$/, '');
        const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

        const mailOptions = {
            from: this.configService.get<string>('SMTP_FROM', '"BrickOptima Support" <brickoptima@gmail.com>'),
            to: email,
            subject: 'Reset Your Password - BrickOptima',
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #f97316;">Reset Your Password</h2>
          <p>You requested to reset your password for your BrickOptima account.</p>
          <p>Please click the button below to reset your password. This link is valid for 1 hour.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Reset Password</a>
          </div>
          <p>If you didn't request this, please ignore this email.</p>
          <hr style="border: 1px solid #eee; margin-top: 30px;" />
          <div style="text-align: center; color: #666; font-size: 12px;">
            <p>BrickOptima Team</p>
            <p>Sent from brickoptima@gmail.com</p>
          </div>
        </div>
      `,
        };

        try {
            await this.transporter.sendMail(mailOptions);
            this.logger.log(`Password reset email sent to ${email}`);
        } catch (error) {
            this.logger.error(`Failed to send password reset email to ${email}`, error);
            // Don't throw error to user to avoid enumeration/blocking, but log it
        }
    }

    async sendVerificationEmail(email: string, token: string) {
        const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000').replace(/\/$/, '');
        const verifyUrl = `${frontendUrl}/verify-email?token=${token}`;

        const mailOptions = {
            from: this.configService.get<string>('SMTP_FROM', '"BrickOptima Support" <brickoptima@gmail.com>'),
            to: email,
            subject: 'Verify Your Email - BrickOptima',
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #f0f0f0; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #f97316; padding: 20px; text-align: center;">
             <h1 style="color: white; margin: 0; font-size: 24px;">BrickOptima</h1>
          </div>
          <div style="padding: 40px 20px;">
            <h2 style="color: #333; margin-top: 0;">Welcome to BrickOptima!</h2>
            <p style="color: #666; line-height: 1.6;">Thank you for signing up. Please verify your email address to activate your account and access all features.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verifyUrl}" style="background-color: #f97316; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Verify Email Address</a>
            </div>
            
            <p style="color: #666; font-size: 14px;">This link will expire in 24 hours.</p>
            <p style="color: #666; font-size: 14px;">If you didn't create an account, you can safely ignore this email.</p>
          </div>
          <div style="background-color: #f9f9f9; padding: 20px; text-align: center; border-top: 1px solid #eee;">
            <p style="color: #999; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} BrickOptima. All rights reserved.</p>
            <p style="color: #999; font-size: 12px; margin: 5px 0 0 0;">brickoptima@gmail.com</p>
          </div>
        </div>
      `,
        };

        try {
            await this.transporter.sendMail(mailOptions);
            this.logger.log(`Verification email sent to ${email}`);
        } catch (error) {
            this.logger.error(`Failed to send verification email to ${email}`, error);
            // We might want to throw here so the user knows the email failed, 
            // but for now we'll log it. If it fails, they can request resend (future feature)
        }
    }
}
