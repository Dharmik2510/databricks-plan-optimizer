import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { CreateChatSessionDto, SendMessageDto } from './dto/chat.dto';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser, CurrentUserData } from '../../common/decorators';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /**
   * Create a new chat session
   * POST /api/v1/chat/sessions
   */
  @Post('sessions')
  async createSession(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreateChatSessionDto,
  ) {
    return this.chatService.createSession(user.id, dto);
  }

  /**
   * Get all chat sessions for current user
   * GET /api/v1/chat/sessions
   */
  @Get('sessions')
  async getSessions(@CurrentUser() user: CurrentUserData) {
    return this.chatService.getSessions(user.id);
  }

  /**
   * Get a specific chat session with messages
   * GET /api/v1/chat/sessions/:id
   */
  @Get('sessions/:id')
  async getSession(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
  ) {
    return this.chatService.getSession(user.id, id);
  }

  /**
   * Send a message in a chat session
   * POST /api/v1/chat/sessions/:id/messages
   */
  @Post('sessions/:id/messages')
  async sendMessage(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(user.id, id, dto);
  }

  /**
   * Delete a chat session
   * DELETE /api/v1/chat/sessions/:id
   */
  @Delete('sessions/:id')
  @HttpCode(HttpStatus.OK)
  async deleteSession(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
  ) {
    return this.chatService.deleteSession(user.id, id);
  }
}
