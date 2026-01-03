import {
    Controller,
    Post,
    Get,
    Body,
    Param,
    Query,
    UseGuards,
    HttpCode,
    HttpStatus,
    Res,
    Delete,
} from '@nestjs/common';
import { Response } from 'express';
import { FeedbackService } from './feedback.service';
import { CreateFeedbackDto, CreateReplyDto, FeedbackQueryDto } from './dto';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser, CurrentUserData } from '../../common/decorators';

@Controller('feedback')
@UseGuards(JwtAuthGuard)
export class FeedbackController {
    constructor(private readonly feedbackService: FeedbackService) { }

    /**
     * Create a new feedback ticket
     * POST /api/v1/feedback
     */
    @Post()
    @HttpCode(HttpStatus.CREATED)
    async createFeedback(
        @CurrentUser() user: CurrentUserData,
        @Body() dto: CreateFeedbackDto,
    ) {
        return this.feedbackService.createFeedback(user.id, dto);
    }

    /**
     * Get user's tickets with pagination
     * GET /api/v1/feedback
     */
    @Get()
    async getMyTickets(
        @CurrentUser() user: CurrentUserData,
        @Query() query: FeedbackQueryDto,
    ) {
        return this.feedbackService.getMyTickets(user.id, query);
    }

    /**
     * Get ticket detail by ticketId
     * GET /api/v1/feedback/:ticketId
     */
    @Get(':ticketId')
    async getTicketDetail(
        @CurrentUser() user: CurrentUserData,
        @Param('ticketId') ticketId: string,
    ) {
        return this.feedbackService.getTicketDetail(user.id, ticketId);
    }

    /**
     * Add a reply to a ticket
     * POST /api/v1/feedback/:ticketId/reply
     */
    @Post(':ticketId/reply')
    @HttpCode(HttpStatus.CREATED)
    async addReply(
        @CurrentUser() user: CurrentUserData,
        @Param('ticketId') ticketId: string,
        @Body() dto: CreateReplyDto,
    ) {
        return this.feedbackService.addReply(user.id, ticketId, dto);
    }

    /**
     * Upload an attachment to a ticket
     * POST /api/v1/feedback/:ticketId/attachments
     */
    @Post(':ticketId/attachments')
    @HttpCode(HttpStatus.CREATED)
    async uploadAttachment(
        @CurrentUser() user: CurrentUserData,
        @Param('ticketId') ticketId: string,
        @Body() body: { data: string; fileName: string; isScreenshot?: boolean },
    ) {
        return this.feedbackService.uploadAttachment(
            user.id,
            ticketId,
            body.data,
            body.fileName,
            body.isScreenshot,
        );
    }

    /**
     * Serve local attachments (for development/fallback only)
     * GET /api/v1/feedback/attachments/local/:fileName
     */
    @Get('attachments/local/:fileName')
    async getLocalAttachment(
        @Param('fileName') fileName: string,
        @Res() res: Response,
    ) {
        return this.feedbackService.serveLocalFile(fileName, res);
    }

    /**
     * Delete a feedback ticket
     * DELETE /api/v1/feedback/:ticketId
     */
    @Delete(':ticketId')
    @HttpCode(HttpStatus.OK)
    async deleteFeedback(
        @CurrentUser() user: CurrentUserData,
        @Param('ticketId') ticketId: string,
    ) {
        return this.feedbackService.deleteFeedback(user.id, ticketId);
    }
}
