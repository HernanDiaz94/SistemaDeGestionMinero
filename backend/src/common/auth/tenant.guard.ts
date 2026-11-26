import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GlobalRole } from '@prisma/client';
import { PUBLIC } from './decorators';
import { AuthUser } from './interfaces';

/**
 * Impide que una petición sin tenant activo acceda a recursos de empresa.
 * El SUPERADMIN puede operar en el panel global sin tenant activo.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUser;
    if (!user) return false;

    if (user.globalRole === GlobalRole.SUPERADMIN) return true;

    if (!user.tenantId) {
      throw new ForbiddenException('Selecciona una empresa activa');
    }
    return true;
  }
}
