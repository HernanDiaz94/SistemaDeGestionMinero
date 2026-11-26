import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GlobalRole } from '@prisma/client';
import { PERMISSIONS_KEY, PUBLIC } from './decorators';
import { AuthUser } from './interfaces';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const user = context.switchToHttp().getRequest().user as AuthUser;
    if (!user) return false;
    if (user.globalRole === GlobalRole.SUPERADMIN) return true;

    const granted = new Set(user.permissions || []);
    if (!required.every((permission) => granted.has(permission))) {
      throw new ForbiddenException(
        `Permisos insuficientes. Se requiere: ${required.join(', ')}`,
      );
    }
    return true;
  }
}
