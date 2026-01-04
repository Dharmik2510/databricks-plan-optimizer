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
    // If analysisId provided, verify it belongs to user
    if (dto.analysisId) {
      const analysis = await this.prisma.analysis.findFirst({
        where: {
          id: dto.analysisId,
          userId,
        },
      });

      if (!analysis) {
        throw new NotFoundException('Analysis not found');
      }
    }

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

    await this.prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: 'ASSISTANT',
        content: initialMessage,
      },
    });

    return session;
  }

  async getSessions(userId: string) {
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

    return sessions;
  }

  async getSession(userId: string, sessionId: string) {
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
      throw new NotFoundException('Chat session not found');
    }

    return session;
  }

  async sendMessage(userId: string, sessionId: string, dto: SendMessageDto) {
    // Verify session exists and belongs to user
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
      throw new NotFoundException('Chat session not found');
    }

    // Save user message
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
    }

    // Build conversation history
    const history = session.messages
      .reverse()
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');

    // Get AI response
    const aiResponse = await this.gemini.chat(dto.content, context, history);

    // Save AI response
    const assistantMessage = await this.prisma.chatMessage.create({
      data: {
        sessionId,
        role: 'ASSISTANT',
        content: aiResponse,
      },
    });

    // Update session
    await this.prisma.chatSession.update({
      where: { id: sessionId },
      data: {
        messageCount: { increment: 2 },
        title: session.title || this.generateTitle(dto.content),
      },
    });

    return {
      userMessage,
      assistantMessage,
    };
  }

  async deleteSession(userId: string, sessionId: string) {
    const session = await this.prisma.chatSession.findFirst({
      where: {
        id: sessionId,
        userId,
      },
    });

    if (!session) {
      throw new NotFoundException('Chat session not found');
    }

    await this.prisma.chatSession.delete({
      where: { id: sessionId },
    });

    return { success: true, message: 'Chat session deleted' };
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
