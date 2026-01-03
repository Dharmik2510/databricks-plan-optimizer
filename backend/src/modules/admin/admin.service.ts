import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole } from '@prisma/client';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) { }

  // ═══════════════════════════════════════════════════════════════
  // ANALYTICS & METRICS
  // ═══════════════════════════════════════════════════════════════

  async getAnalyticsOverview() {
    const [
      totalUsers,
      activeUsers,
      totalAnalyses,
      completedAnalyses,
      failedAnalyses,
      totalChatSessions,
      avgAnalysesPerUser,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.analysis.count(),
      this.prisma.analysis.count({ where: { status: 'COMPLETED' } }),
      this.prisma.analysis.count({ where: { status: 'FAILED' } }),
      this.prisma.chatSession.count(),
      this.prisma.user.findMany({
        select: { analysisCount: true },
      }).then(users => {
        const total = users.reduce((sum, u) => sum + u.analysisCount, 0);
        return users.length > 0 ? total / users.length : 0;
      }),
    ]);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [newUsersThisMonth, analysesThisMonth] = await Promise.all([
      this.prisma.user.count({
        where: { createdAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.analysis.count({
        where: { createdAt: { gte: thirtyDaysAgo } },
      }),
    ]);

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        newThisMonth: newUsersThisMonth,
        suspended: totalUsers - activeUsers,
      },
      analyses: {
        total: totalAnalyses,
        completed: completedAnalyses,
        failed: failedAnalyses,
        thisMonth: analysesThisMonth,
        successRate: totalAnalyses > 0
          ? ((completedAnalyses / totalAnalyses) * 100).toFixed(2)
          : 0,
      },
      chat: {
        totalSessions: totalChatSessions,
      },
      engagement: {
        avgAnalysesPerUser: avgAnalysesPerUser.toFixed(2),
      },
    };
  }

  async getUserGrowth(days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const users = await this.prisma.user.findMany({
      where: { createdAt: { gte: startDate } },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    // Group by day
    const growthByDay: Record<string, number> = {};
    users.forEach((user) => {
      const date = user.createdAt.toISOString().split('T')[0];
      growthByDay[date] = (growthByDay[date] || 0) + 1;
    });

    return Object.entries(growthByDay).map(([date, count]) => ({
      date,
      newUsers: count,
    }));
  }

  async getUsageStats(days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [analyses, chatSessions] = await Promise.all([
      this.prisma.analysis.findMany({
        where: { createdAt: { gte: startDate } },
        select: { createdAt: true, status: true, processingMs: true },
      }),
      this.prisma.chatSession.findMany({
        where: { createdAt: { gte: startDate } },
        select: { createdAt: true, messageCount: true },
      }),
    ]);

    // Group analyses by day
    const analysesByDay: Record<string, { count: number; avgProcessingMs: number; processingMsTotal: number; processingMsCount: number }> = {};
    analyses.forEach((analysis) => {
      const date = analysis.createdAt.toISOString().split('T')[0];
      if (!analysesByDay[date]) {
        analysesByDay[date] = { count: 0, avgProcessingMs: 0, processingMsTotal: 0, processingMsCount: 0 };
      }
      analysesByDay[date].count++;
      if (analysis.processingMs) {
        analysesByDay[date].processingMsTotal += analysis.processingMs;
        analysesByDay[date].processingMsCount++;
      }
    });

    // Calculate averages
    Object.values(analysesByDay).forEach((day) => {
      day.avgProcessingMs = day.processingMsCount > 0
        ? day.processingMsTotal / day.processingMsCount
        : 0;
    });

    const chatsByDay: Record<string, number> = {};
    chatSessions.forEach((session) => {
      const date = session.createdAt.toISOString().split('T')[0];
      chatsByDay[date] = (chatsByDay[date] || 0) + 1;
    });

    const dates = Array.from(
      new Set([...Object.keys(analysesByDay), ...Object.keys(chatsByDay)]),
    ).sort();

    return dates.map((date) => ({
      date,
      analyses: analysesByDay[date]?.count || 0,
      avgProcessingMs: Math.round(analysesByDay[date]?.avgProcessingMs || 0),
      chatSessions: chatsByDay[date] || 0,
    }));
  }

  async getPopularFeatures() {
    const [
      totalAnalyses,
      sqlExplainCount,
      sparkPlanCount,
      logFileCount,
      chatSessionsWithAnalysis,
      chatSessionsStandalone,
      repositoryLinkedAnalyses,
    ] = await Promise.all([
      this.prisma.analysis.count(),
      this.prisma.analysis.count({ where: { inputType: 'SQL_EXPLAIN' } }),
      this.prisma.analysis.count({ where: { inputType: 'SPARK_PLAN' } }),
      this.prisma.analysis.count({ where: { inputType: 'LOG_FILE' } }),
      this.prisma.chatSession.count({ where: { analysisId: { not: null } } }),
      this.prisma.chatSession.count({ where: { analysisId: null } }),
      this.prisma.analysis.count({
        where: {
          result: {
            path: ['codeMappings'],
            not: { equals: null },
          },
        },
      }),
    ]);

    return {
      inputTypes: [
        { type: 'SPARK_PLAN', count: sparkPlanCount, percentage: totalAnalyses > 0 ? ((sparkPlanCount / totalAnalyses) * 100).toFixed(2) : 0 },
        { type: 'SQL_EXPLAIN', count: sqlExplainCount, percentage: totalAnalyses > 0 ? ((sqlExplainCount / totalAnalyses) * 100).toFixed(2) : 0 },
        { type: 'LOG_FILE', count: logFileCount, percentage: totalAnalyses > 0 ? ((logFileCount / totalAnalyses) * 100).toFixed(2) : 0 },
      ],
      chat: {
        withAnalysis: chatSessionsWithAnalysis,
        standalone: chatSessionsStandalone,
      },
      repository: {
        linkedAnalyses: repositoryLinkedAnalyses,
      },
    };
  }

  async getSystemHealth() {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const [
      pendingAnalyses,
      processingAnalyses,
      recentFailures,
      avgProcessingTime,
    ] = await Promise.all([
      this.prisma.analysis.count({ where: { status: 'PENDING' } }),
      this.prisma.analysis.count({ where: { status: 'PROCESSING' } }),
      this.prisma.analysis.count({
        where: {
          status: 'FAILED',
          createdAt: { gte: oneHourAgo },
        },
      }),
      this.prisma.analysis.aggregate({
        where: {
          status: 'COMPLETED',
          createdAt: { gte: fiveMinutesAgo },
          processingMs: { not: null },
        },
        _avg: { processingMs: true },
      }),
    ]);

    return {
      queue: {
        pending: pendingAnalyses,
        processing: processingAnalyses,
      },
      errors: {
        recentFailures,
      },
      performance: {
        avgProcessingMs: Math.round(avgProcessingTime._avg.processingMs || 0),
      },
      status: recentFailures > 10 ? 'degraded' : 'healthy',
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // USER MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  async getAllUsers(params: {
    page: number;
    limit: number;
    search?: string;
    role?: UserRole;
    isActive?: boolean;
  }) {
    const { page, limit, search, role, isActive } = params;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (role) {
      where.role = role;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          name: true,
          avatar: true,
          role: true,
          isActive: true,
          analysisCount: true,
          quotaLimit: true,
          lastLoginAt: true,
          createdAt: true,
          _count: {
            select: {
              analyses: true,
              chatSessions: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUserDetails(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        isActive: true,
        analysisCount: true,
        quotaLimit: true,
        lastAnalysisAt: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        settings: true,
        _count: {
          select: {
            analyses: true,
            chatSessions: true,
            refreshTokens: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get recent analyses
    const recentAnalyses = await this.prisma.analysis.findMany({
      where: { userId },
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        status: true,
        severity: true,
        createdAt: true,
        processingMs: true,
      },
    });

    return {
      ...user,
      recentAnalyses,
    };
  }

  async updateUser(userId: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        quotaLimit: true,
      },
    });
  }

  async suspendUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });
  }

  async activateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive: true },
    });
  }

  async getUserActivity(userId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [analyses, chatSessions] = await Promise.all([
      this.prisma.analysis.findMany({
        where: {
          userId,
          createdAt: { gte: startDate },
        },
        select: { createdAt: true, status: true },
      }),
      this.prisma.chatSession.findMany({
        where: {
          userId,
          createdAt: { gte: startDate },
        },
        select: { createdAt: true, messageCount: true },
      }),
    ]);

    const activityByDay: Record<string, { analyses: number; chats: number }> = {};

    analyses.forEach((analysis) => {
      const date = analysis.createdAt.toISOString().split('T')[0];
      if (!activityByDay[date]) {
        activityByDay[date] = { analyses: 0, chats: 0 };
      }
      activityByDay[date].analyses++;
    });

    chatSessions.forEach((session) => {
      const date = session.createdAt.toISOString().split('T')[0];
      if (!activityByDay[date]) {
        activityByDay[date] = { analyses: 0, chats: 0 };
      }
      activityByDay[date].chats++;
    });

    return Object.entries(activityByDay)
      .map(([date, activity]) => ({
        date,
        ...activity,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // ═══════════════════════════════════════════════════════════════
  // ANALYSIS MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  async getRecentAnalyses(limit: number = 50) {
    return this.prisma.analysis.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        status: true,
        severity: true,
        createdAt: true,
        processingMs: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });
  }

  async getFailedAnalyses(limit: number = 50) {
    return this.prisma.analysis.findMany({
      where: { status: 'FAILED' },
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        errorMessage: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // FEEDBACK MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  async getAllFeedback(params: {
    page: number;
    limit: number;
    status?: string;
    category?: string;
  }) {
    const { page, limit, status, category } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (category) where.category = category;

    console.log(`[AdminService] Fetching feedback with params:`, { page, limit, status, category, where });

    const [tickets, total] = await Promise.all([
      this.prisma.userFeedback.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
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
            select: {
              events: true,
              attachments: true,
            },
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
      _debug: { fetchedCount: tickets.length, totalCount: total }
    };
  }

  async getFeedbackStats() {
    const [total, open, resolved, critical, inProgress, pending] = await Promise.all([
      this.prisma.userFeedback.count(),
      this.prisma.userFeedback.count({ where: { status: 'open' } }),
      this.prisma.userFeedback.count({ where: { status: 'resolved' } }),
      this.prisma.userFeedback.count({ where: { severity: 'critical' } }),
      this.prisma.userFeedback.count({ where: { status: 'in_progress' } }),
      this.prisma.userFeedback.count({ where: { status: 'pending' } }),
    ]);

    return {
      total,
      open,
      resolved,
      critical,
      inProgress,
      pending,
    };
  }

  async getFeedbackDetail(ticketId: string) {
    const ticket = await this.prisma.userFeedback.findUnique({
      where: { id: ticketId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
        events: {
          orderBy: { createdAt: 'asc' },
          include: {
            author: {
              select: {
                id: true,
                name: true,
                avatar: true,
                role: true,
              },
            },
          },
        },
        attachments: {
          orderBy: { uploadedAt: 'desc' },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException(`Feedback ticket ${ticketId} not found`);
    }

    return ticket;
  }

  async updateFeedbackStatus(ticketId: string, status: string) {
    const ticket = await this.prisma.userFeedback.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException(`Feedback ticket ${ticketId} not found`);
    }

    const updatedTicket = await this.prisma.userFeedback.update({
      where: { id: ticketId },
      data: {
        status,
        ...(status === 'resolved' && { resolvedAt: new Date() }),
      },
    });

    // Create a status change event
    await this.prisma.feedbackEvent.create({
      data: {
        feedbackId: ticket.id,
        eventType: 'STATUS_CHANGE',
        content: `Status changed to ${status}`,
        isInternal: false,
      },
    });

    return updatedTicket;
  }

  async addFeedbackReply(
    ticketId: string,
    adminId: string,
    content: string,
    isInternal: boolean = false,
  ) {
    const ticket = await this.prisma.userFeedback.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException(`Feedback ticket ${ticketId} not found`);
    }

    const event = await this.prisma.feedbackEvent.create({
      data: {
        feedbackId: ticket.id,
        eventType: 'REPLY',
        content,
        isInternal,
        authorId: adminId,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            avatar: true,
            role: true,
          },
        },
      },
    });

    // Update ticket's updatedAt timestamp
    await this.prisma.userFeedback.update({
      where: { id: ticketId },
      data: { updatedAt: new Date() },
    });

    return event;
  }

  async assignFeedback(ticketId: string, adminId: string) {
    const ticket = await this.prisma.userFeedback.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException(`Feedback ticket ${ticketId} not found`);
    }

    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw new NotFoundException(`Admin user ${adminId} not found`);
    }

    const updatedTicket = await this.prisma.userFeedback.update({
      where: { id: ticketId },
      data: { assignedToId: adminId },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });

    // Create an assignment event
    await this.prisma.feedbackEvent.create({
      data: {
        feedbackId: ticket.id,
        eventType: 'ASSIGNED',
        content: `Assigned to ${admin.name}`,
        isInternal: false,
      },
    });

    return updatedTicket;
  }
}
