import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export interface CurrentUserData {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role?: UserRole;
  isActive?: boolean;
  settings?: any;
  analysisCount?: number;
  createdAt?: Date;
}

export const CurrentUser = createParamDecorator(
  (data: keyof CurrentUserData | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as CurrentUserData;

    if (!user) {
      return null;
    }

    return data ? user[data] : user;
  },
);
