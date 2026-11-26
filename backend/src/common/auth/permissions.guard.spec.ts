import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GlobalRole } from '@prisma/client';
import { PermissionsGuard } from './permissions.guard';

function context(user: any): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getClass: () => class {},
    getHandler: () => () => undefined,
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;
  const guard = new PermissionsGuard(reflector);

  beforeEach(() => jest.clearAllMocks());

  it('permite superadmin sin lista de permisos', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValueOnce(false).mockReturnValueOnce(['reports.approve']);
    expect(
      guard.canActivate(
        context({ globalRole: GlobalRole.SUPERADMIN, permissions: [] }),
      ),
    ).toBe(true);
  });

  it('permite si el usuario tiene todos los permisos requeridos', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValueOnce(false).mockReturnValueOnce(['reports.read', 'reports.create']);
    expect(
      guard.canActivate(
        context({
          globalRole: GlobalRole.USER,
          permissions: ['reports.read', 'reports.create', 'reports.update'],
        }),
      ),
    ).toBe(true);
  });

  it('rechaza si falta algún permiso', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValueOnce(false).mockReturnValueOnce(['reports.approve']);
    expect(() =>
      guard.canActivate(context({ globalRole: GlobalRole.USER, permissions: ['reports.read'] })),
    ).toThrow(ForbiddenException);
  });

  it('no exige permisos en rutas públicas', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(true);
    expect(guard.canActivate(context(undefined))).toBe(true);
  });
});
