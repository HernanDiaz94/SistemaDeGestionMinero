import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { GlobalRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuditService } from '../../common/audit/audit.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const user = {
    id: 'user-1',
    email: 'sup@test.cl',
    passwordHash: bcrypt.hashSync('Demo1234!', 10),
    firstName: 'Ana',
    lastName: 'Diaz',
    globalRole: GlobalRole.USER,
    status: UserStatus.ACTIVE,
  };
  const membership = {
    id: 'tu-1',
    tenantId: 'tenant-1',
    userId: 'user-1',
    tenant: { id: 'tenant-1', name: 'Minera Test', slug: 'minera-test', status: 'ACTIVE', timezone: 'UTC' },
    roles: [
      {
        role: {
          permissions: [{ permission: { key: 'reports.read' } }, { permission: { key: 'reports.create' } }],
        },
      },
    ],
  };

  const prisma: any = {
    user: {
      findUnique: jest.fn().mockResolvedValue(user),
      update: jest.fn().mockResolvedValue(user),
    },
    tenantUser: { findMany: jest.fn().mockResolvedValue([membership]) },
    tenant: { findUnique: jest.fn() },
    auditLog: { create: jest.fn() },
  };
  const jwt: any = { signAsync: jest.fn().mockResolvedValue('token'), verifyAsync: jest.fn() };
  const config: any = { get: jest.fn().mockReturnValue('secret') };
  const audit: any = { log: jest.fn().mockResolvedValue(undefined) };

  const service = new AuthService(prisma, jwt as JwtService, config as ConfigService, audit as AuditService);

  beforeEach(() => jest.clearAllMocks());

  it('genera tokens con los permisos del tenant activo', async () => {
    const result = await service.login({
      email: 'sup@test.cl',
      password: 'Demo1234!',
    });
    expect(result.accessToken).toBe('token');
    expect(result.refreshToken).toBe('token');
    expect(result.user.permissions).toEqual(['reports.read', 'reports.create']);
    expect(result.user.tenantId).toBe('tenant-1');
    expect(jwt.signAsync).toHaveBeenCalledTimes(2);
  });

  it('rechaza contraseña incorrecta', async () => {
    await expect(
      service.login({ email: 'sup@test.cl', password: 'incorrecta' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rechaza tenants a los que el usuario no pertenece', async () => {
    await expect(
      service.login({ email: 'sup@test.cl', password: 'Demo1234!', tenantSlug: 'otra-empresa' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
