import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from './storage.service';
import { CreateFeedbackDto, CreateReplyDto, FeedbackQueryDto } from './dto';
import { getRequestContext } from '../../common/middleware/request-context.middleware';
import { Prisma } from '@prisma/client';

@Injectable()
export class FeedbackService {
    private readonly logger = new Logger(FeedbackService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly storageService: StorageService,
    ) { }

    /**
     * Create a new feedback ticket with context auto-capture
     */
    async createFeedback(userId: string, dto: CreateFeedbackDto) {
        const context = getRequestContext();

        // Create the feedback record
        const feedback = await this.prisma.userFeedback.create({
            data: {
                userId,
                title: dto.title,
                description: dto.description,
                severity: dto.severity,
                category: dto.category,
                feature: dto.feature || this.inferFeature(dto.pageUrl),
                status: 'new',
                tags: [],
                // Context auto-capture
                correlationId: context?.correlationId,
                traceId: context?.traceId,
                requestId: context?.requestId,
                sessionId: context?.sessionId,
                pageUrl: dto.pageUrl,
                userAgent: dto.userAgent,
                browserInfo: dto.browserInfo as Prisma.InputJsonValue,
                appVersion: dto.appVersion,
                lastAction: dto.lastAction,
            },
            include: {
                user: {
                    select: { id: true, name: true, email: true, avatar: true },
                },
            },
        });

        // Create initial event for ticket creation
        await this.prisma.feedbackEvent.create({
            data: {
                feedbackId: feedback.id,
                eventType: 'created',
                authorId: userId,
                isInternal: false,
                content: null,
                metadata: {
                    severity: dto.severity,
                    category: dto.category,
                } as Prisma.InputJsonValue,
            },
        });

        // Handle screenshot upload if provided
        if (dto.screenshot) {
            try {
                const uploadResult = await this.storageService.uploadFile(
                    dto.screenshot,
                    'screenshot.png',
                    feedback.id,
                    true,
                );

                await this.prisma.feedbackAttachment.create({
                    data: {
                        feedbackId: feedback.id,
                        fileName: 'screenshot.png',
                        fileType: uploadResult.fileType,
                        fileSize: uploadResult.fileSize,
                        storageUrl: uploadResult.storageUrl,
                        isScreenshot: true,
                        screenshotMeta: {
                            capturedAt: new Date().toISOString(),
                            source: 'html2canvas',
                        } as Prisma.InputJsonValue,
                    },
                });

                this.logger.log(`Screenshot uploaded for feedback ${feedback.ticketId}`);
            } catch (error) {
                this.logger.error(`Failed to upload screenshot for feedback ${feedback.ticketId}`, error);
                // Don't fail the feedback creation if screenshot upload fails
            }
        }

        this.logger.log(`Feedback created: ${feedback.ticketId} by user ${userId}`);

        return {
            id: feedback.id,
            ticketId: feedback.ticketId,
            title: feedback.title,
            status: feedback.status,
            severity: feedback.severity,
            category: feedback.category,
            createdAt: feedback.createdAt,
        };
    }

    /**
     * Get user's feedback tickets with pagination and filtering
     */
    async getMyTickets(userId: string, query: FeedbackQueryDto) {
        const page = query.page || 1;
        const limit = Math.min(query.limit || 10, 50);
        const skip = (page - 1) * limit;

        const where: Prisma.UserFeedbackWhereInput = {
            userId,
            ...(query.status && { status: query.status }),
            ...(query.category && { category: query.category }),
        };

        const [tickets, total] = await Promise.all([
            this.prisma.userFeedback.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
                select: {
                    id: true,
                    ticketId: true,
                    title: true,
                    status: true,
                    severity: true,
                    category: true,
                    feature: true,
                    createdAt: true,
                    updatedAt: true,
                    resolvedAt: true,
                    _count: {
                        select: { events: true, attachments: true },
                    },
                },
            }),
            this.prisma.userFeedback.count({ where }),
        ]);

        return {
            tickets,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Get ticket detail with events timeline
     */
    async getTicketDetail(userId: string, ticketId: string) {
        const ticket = await this.prisma.userFeedback.findUnique({
            where: { ticketId },
            include: {
                user: {
                    select: { id: true, name: true, email: true, avatar: true },
                },
                assignedTo: {
                    select: { id: true, name: true, avatar: true },
                },
                attachments: {
                    orderBy: { uploadedAt: 'asc' },
                },
                events: {
                    orderBy: { createdAt: 'asc' },
                    include: {
                        author: {
                            select: { id: true, name: true, avatar: true, role: true },
                        },
                    },
                },
            },
        });

        if (!ticket) {
            throw new NotFoundException(`Ticket ${ticketId} not found`);
        }

        // Users can only view their own tickets
        if (ticket.userId !== userId) {
            throw new ForbiddenException('You can only view your own tickets');
        }

        // Generate signed URLs for attachments
        const attachmentsWithUrls = await Promise.all(
            ticket.attachments.map(async (attachment) => ({
                ...attachment,
                viewUrl: await this.storageService.getSignedUrl(attachment.storageUrl),
            })),
        );

        // Filter out internal events for users
        const visibleEvents = ticket.events.filter((event) => !event.isInternal);

        return {
            ...ticket,
            attachments: attachmentsWithUrls,
            events: visibleEvents,
        };
    }

    /**
     * Add a reply to a ticket
     */
    async addReply(userId: string, ticketId: string, dto: CreateReplyDto) {
        const ticket = await this.prisma.userFeedback.findUnique({
            where: { ticketId },
            select: { id: true, userId: true, status: true },
        });

        if (!ticket) {
            throw new NotFoundException(`Ticket ${ticketId} not found`);
        }

        if (ticket.userId !== userId) {
            throw new ForbiddenException('You can only reply to your own tickets');
        }

        // Create reply event
        const event = await this.prisma.feedbackEvent.create({
            data: {
                feedbackId: ticket.id,
                eventType: 'user_reply',
                authorId: userId,
                isInternal: false,
                content: dto.content,
            },
            include: {
                author: {
                    select: { id: true, name: true, avatar: true },
                },
            },
        });

        // Update ticket's updatedAt timestamp
        await this.prisma.userFeedback.update({
            where: { id: ticket.id },
            data: { updatedAt: new Date() },
        });

        this.logger.log(`User reply added to ticket ${ticketId}`);

        return event;
    }

    /**
     * Upload an attachment to a ticket
     */
    async uploadAttachment(
        userId: string,
        ticketId: string,
        base64Data: string,
        fileName: string,
        isScreenshot = false,
    ) {
        const ticket = await this.prisma.userFeedback.findUnique({
            where: { ticketId },
            select: { id: true, userId: true },
        });

        if (!ticket) {
            throw new NotFoundException(`Ticket ${ticketId} not found`);
        }

        if (ticket.userId !== userId) {
            throw new ForbiddenException('You can only add attachments to your own tickets');
        }

        const uploadResult = await this.storageService.uploadFile(
            base64Data,
            fileName,
            ticket.id,
            isScreenshot,
        );

        const attachment = await this.prisma.feedbackAttachment.create({
            data: {
                feedbackId: ticket.id,
                fileName,
                fileType: uploadResult.fileType,
                fileSize: uploadResult.fileSize,
                storageUrl: uploadResult.storageUrl,
                isScreenshot,
                screenshotMeta: isScreenshot
                    ? ({ capturedAt: new Date().toISOString() } as Prisma.InputJsonValue)
                    : undefined,
            },
        });

        return {
            ...attachment,
            viewUrl: await this.storageService.getSignedUrl(attachment.storageUrl),
        };
    }

    /**
     * Delete a feedback ticket and its attachments
     */
    async deleteFeedback(userId: string, ticketId: string) {
        // First find the ticket to check ownership and get ID
        const ticket = await this.prisma.userFeedback.findUnique({
            where: { ticketId },
            include: {
                attachments: true,
            },
        });

        if (!ticket) {
            throw new NotFoundException(`Ticket ${ticketId} not found`);
        }

        // Users can only delete their own tickets
        if (ticket.userId !== userId) {
            throw new ForbiddenException('You can only delete your own tickets');
        }

        // Delete all attachments from storage
        for (const attachment of ticket.attachments) {
            if (attachment.storageUrl) {
                await this.storageService.deleteFile(attachment.storageUrl);
            }
        }

        // Delete the ticket from database
        // Relations (attachments, events) will be deleted due to CASCADE in schema
        await this.prisma.userFeedback.delete({
            where: { id: ticket.id },
        });

        this.logger.log(`Feedback deleted: ${ticket.ticketId} by user ${userId}`);

        return { success: true };
    }

    /**
     * Serve a local file
     */
    serveLocalFile(fileName: string, res: any) {
        const filePath = this.storageService.getFilePath(fileName);

        // Safety check to prevent directory traversal
        if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
            throw new NotFoundException('Invalid file name');
        }

        return res.sendFile(filePath);
    }

    private inferFeature(pageUrl?: string): string {
        if (!pageUrl) return 'general';
        if (pageUrl.includes('/analysis') || pageUrl.includes('/dashboard')) return 'analysis';
        if (pageUrl.includes('/mapping') || pageUrl.includes('/code-map')) return 'mapping';
        if (pageUrl.includes('/chat')) return 'chat';
        if (pageUrl.includes('/cost')) return 'cost';
        if (pageUrl.includes('/history')) return 'history';
        if (pageUrl.includes('/admin')) return 'admin';
        return 'general';
    }
}
