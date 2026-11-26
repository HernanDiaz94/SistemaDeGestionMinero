import { ForbiddenException } from '@nestjs/common';
import { paginated, parsePagination, tenantData, tenantWhere } from './tenant-scope';

describe('tenant helpers', () => {
  it('fuerza el tenantId en los filtros y no permite sobrescribirlo', () => {
    const result = tenantWhere('tenant-a', { status: 'ACTIVE', tenantId: 'tenant-b' });
    expect(result).toEqual({ status: 'ACTIVE', tenantId: 'tenant-a' });
  });

  it('fuerza el tenantId en los datos de creación', () => {
    expect(tenantData('tenant-a', { name: 'Proyecto', tenantId: 'intruso' })).toEqual({
      name: 'Proyecto',
      tenantId: 'tenant-a',
    });
  });

  it('falla cerrado si no hay tenant activo', () => {
    expect(() => tenantWhere(undefined as any)).toThrow(ForbiddenException);
    expect(() => tenantData(undefined as any, {})).toThrow(ForbiddenException);
  });

  it('normaliza paginación con límites seguros', () => {
    expect(parsePagination({ page: '-3', limit: '5000' })).toEqual({
      page: 1,
      limit: 200,
      skip: 0,
      take: 200,
    });
    expect(parsePagination({ page: '3', limit: '10' }).skip).toBe(20);
  });

  it('calcula meta de paginación', () => {
    expect(paginated([1, 2], 25, 2, 10).meta).toEqual({
      total: 25,
      page: 2,
      limit: 10,
      totalPages: 3,
    });
  });
});
