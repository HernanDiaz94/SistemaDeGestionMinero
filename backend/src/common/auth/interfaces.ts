import { GlobalRole } from '@prisma/client';

export interface AuthUser {
  userId: string;
  email: string;
  globalRole: GlobalRole;
  tenantId?: string;
  tenantUserId?: string;
  permissions: string[];
  iat?: number;
  exp?: number;
}
