import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GlobalRole } from '@prisma/client';
import { TenantGuard } from './tenant.guard';

function context(user: any): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getClass: () => class {},
    getHandler: () => () => undefined,
  } as unknown as ExecutionContext;
}

describe('TenantGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(false),
  } as unknown as Reflector;
  const guard = new TenantGuard(reflector);

  beforeEach(() => (reflector.getAllAndOverride as jest.Mock).mockReturnValue(false));

  it('permite una petición con tenant activo', () => {
    expect(
      guard.canActivate(context({ globalRole: GlobalRole.USER, tenantId: 'tenant-a' })),
    ).toBe(true);
  });

  it('rechaza una petición sin tenant', () => {
    expect(() =>
      guard.canActivate(context({ globalRole: GlobalRole.USER, tenantId: undefined })),
    ).toThrow(ForbiddenException);
  });

  it('permite al superadmin en el panel global', () => {
    expect(
      guard.canActivate(context({ globalRole: GlobalRole.SUPERADMIN, tenantId: undefined })),
    ).toBe(true);
  });

  it('permite rutas públicas', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(true);
    expect(guard.canActivate(context(undefined))).toBe(true);
  });
});
