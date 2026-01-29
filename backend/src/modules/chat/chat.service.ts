import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GeminiService } from '../../integrations/gemini/gemini.service';
import { CreateChatSessionDto, SendMessageDto } from './dto/chat.dto';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private prisma: PrismaService,
    private gemini: GeminiService,
  ) { }

  async createSession(userId: string, dto: CreateChatSessionDto) {
    try {
      this.logger.log('Creating chat session', {
        userId,
        analysisId: dto.analysisId,
        hasTitle: !!dto.title,
      });

      // If analysisId provided, verify it belongs to user
      if (dto.analysisId) {
        this.logger.log('Verifying analysis ownership', { analysisId: dto.analysisId });

        const analysis = await this.prisma.analysis.findFirst({
          where: {
            id: dto.analysisId,
            userId,
          },
        });

        if (!analysis) {
          this.logger.warn('Analysis not found or unauthorized', {
            analysisId: dto.analysisId,
            userId,
          });
          throw new NotFoundException('Analysis not found');
        }

        this.logger.log('Analysis verified successfully');
      }

      this.logger.log('Creating session in database');
      const session = await this.prisma.chatSession.create({
        data: {
          userId,
          analysisId: dto.analysisId,
          title: dto.title,
        },
        include: {
          analysis: {
            select: {
              id: true,
              title: true,
              result: true,
            },
          },
        },
      });

      // Add initial AI message
      const initialMessage = dto.analysisId
        ? 'I\'ve loaded the analysis context. Feel free to ask about optimization opportunities, join strategies, shuffle operations, or any specific stage in the DAG.'
        : 'Hello! I\'m your Spark performance consultant. You can ask me about DAG optimization, join strategies, shuffle reduction, and more. How can I help you today?';

      this.logger.log('Adding initial AI message to session', { sessionId: session.id });
      await this.prisma.chatMessage.create({
        data: {
          sessionId: session.id,
          role: 'ASSISTANT',
          content: initialMessage,
        },
      });

      this.logger.log('✅ Chat session created successfully', {
        sessionId: session.id,
        hasAnalysis: !!dto.analysisId,
      });

      return session;
    } catch (error) {
      this.logger.error('❌ Failed to create chat session', {
        userId,
        analysisId: dto.analysisId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  async getSessions(userId: string) {
    try {
      this.logger.log('Fetching chat sessions for user', { userId });

      const sessions = await this.prisma.chatSession.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          title: true,
          messageCount: true,
          analysisId: true,
          createdAt: true,
          updatedAt: true,
          analysis: {
            select: {
              title: true,
            },
          },
        },
      });

      this.logger.log('✅ Chat sessions retrieved successfully', {
        userId,
        count: sessions.length,
      });

      return sessions;
    } catch (error) {
      this.logger.error('❌ Failed to fetch chat sessions', {
        userId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  async getSession(userId: string, sessionId: string) {
    try {
      this.logger.log('Fetching chat session details', { userId, sessionId });

      const session = await this.prisma.chatSession.findFirst({
        where: {
          id: sessionId,
          userId,
        },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
          },
          analysis: {
            select: {
              id: true,
              title: true,
              result: true,
            },
          },
        },
      });

      if (!session) {
        this.logger.warn('Chat session not found or unauthorized', {
          sessionId,
          userId,
        });
        throw new NotFoundException('Chat session not found');
      }

      this.logger.log('✅ Chat session retrieved successfully', {
        sessionId,
        messageCount: session.messages.length,
        hasAnalysis: !!session.analysisId,
      });

      return session;
    } catch (error) {
      this.logger.error('❌ Failed to fetch chat session', {
        userId,
        sessionId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  async sendMessage(userId: string, sessionId: string, dto: SendMessageDto) {
    const startTime = Date.now();

    try {
      this.logger.log('Processing chat message', {
        userId,
        sessionId,
        messageLength: dto.content.length,
      });

      // Verify session exists and belongs to user
      this.logger.log('Verifying session ownership');
      const session = await this.prisma.chatSession.findFirst({
        where: {
          id: sessionId,
          userId,
        },
        include: {
          analysis: {
            select: {
              result: true,
            },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 10, // Get last 10 messages for context
          },
        },
      });

      if (!session) {
        this.logger.warn('Chat session not found or unauthorized', {
          sessionId,
          userId,
        });
        throw new NotFoundException('Chat session not found');
      }

      // Save user message
      this.logger.log('Saving user message to database');
      const userMessage = await this.prisma.chatMessage.create({
        data: {
          sessionId,
          role: 'USER',
          content: dto.content,
        },
      });

      // Build context from analysis result if available
      let context = '';
      if (session.analysis?.result) {
        this.logger.log('Building analysis context for AI');
        const result = session.analysis.result as any;
        context = `Analysis Summary: ${result.summary || 'No summary'}\n`;

        if (result.optimizations?.length) {
          context += `\n--- DETAILED FINDINGS ---\n`;
          context += `Found ${result.optimizations.length} optimization opportunities:\n\n`;

          result.optimizations.forEach((o: any, index: number) => {
            context += `${index + 1}. [${o.severity}] ${o.title}\n`;
            context += `   Description: ${o.description}\n`;
            context += `   Reasoning: ${o.impactReasoning || o.reasoning || 'N/A'}\n`;
            if (o.codeSuggestion) {
              context += `   Suggested Fix: ${o.codeSuggestion}\n`;
            }
            if (o.affected_stages?.length) {
              context += `   Affected Stages: ${o.affected_stages.join(', ')}\n`;
            }
            context += '\n';
          });
          context += `--------------------------\n`;
        }

        this.logger.log('Analysis context built', {
          contextLength: context.length,
          optimizationCount: result.optimizations?.length || 0,
        });
      }

      // Build conversation history
      const history = session.messages
        .reverse()
        .map((m) => `${m.role}: ${m.content}`)
        .join('\n');

      this.logger.log('Conversation history prepared', {
        historyMessageCount: session.messages.length,
        historyLength: history.length,
      });

      // Get AI response
      this.logger.log('Calling Gemini AI service');
      const aiStartTime = Date.now();
      const aiResponse = await this.gemini.chat(dto.content, context, history);
      const aiLatency = Date.now() - aiStartTime;

      this.logger.log('✅ AI response received', {
        latencyMs: aiLatency,
        responseLength: aiResponse.length,
      });

      // Save AI response
      this.logger.log('Saving AI response to database');
      const assistantMessage = await this.prisma.chatMessage.create({
        data: {
          sessionId,
          role: 'ASSISTANT',
          content: aiResponse,
        },
      });

      // Update session
      this.logger.log('Updating session metadata');
      await this.prisma.chatSession.update({
        where: { id: sessionId },
        data: {
          messageCount: { increment: 2 },
          title: session.title || this.generateTitle(dto.content),
        },
      });

      const totalLatency = Date.now() - startTime;
      this.logger.log('✅ Message processed successfully', {
        sessionId,
        totalLatencyMs: totalLatency,
        aiLatencyMs: aiLatency,
        userMessageId: userMessage.id,
        assistantMessageId: assistantMessage.id,
      });

      return {
        userMessage,
        assistantMessage,
      };
    } catch (error) {
      const totalLatency = Date.now() - startTime;
      this.logger.error('❌ Failed to process chat message', {
        userId,
        sessionId,
        latencyMs: totalLatency,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  async deleteSession(userId: string, sessionId: string) {
    try {
      this.logger.log('Deleting chat session', { userId, sessionId });

      const session = await this.prisma.chatSession.findFirst({
        where: {
          id: sessionId,
          userId,
        },
      });

      if (!session) {
        this.logger.warn('Chat session not found or unauthorized for deletion', {
          sessionId,
          userId,
        });
        throw new NotFoundException('Chat session not found');
      }

      this.logger.log('Deleting session from database', {
        sessionId,
        messageCount: session.messageCount,
      });

      await this.prisma.chatSession.delete({
        where: { id: sessionId },
      });

      this.logger.log('✅ Chat session deleted successfully', { sessionId });

      return { success: true, message: 'Chat session deleted' };
    } catch (error) {
      this.logger.error('❌ Failed to delete chat session', {
        userId,
        sessionId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  private generateTitle(content: string): string {
    // Generate a title from the first message
    const maxLength = 50;
    const cleaned = content.replace(/\n/g, ' ').trim();

    if (cleaned.length <= maxLength) {
      return cleaned;
    }

    return cleaned.substring(0, maxLength - 3) + '...';
  }
}
