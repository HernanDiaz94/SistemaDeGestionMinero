import { ForbiddenException } from '@nestjs/common';

/**
 * Helpers de aislamiento multi-tenant.
 *
 * REGLA: toda consulta a una tabla con tenantId DEBE pasar por `tenantWhere`
 * y toda creación DEBE pasar por `tenantData`. El tenantId nunca se toma del
 * cuerpo de la petición, sino del token JWT verificado.
 *
 * Fail-closed: si no hay tenant activo se bloquea la operación. Así, incluso
 * un SUPERADMIN que llame a un endpoint de negocio sin seleccionar empresa no
 * puede leer o escribir datos de todas las empresas a la vez.
 */
function assertTenant(tenantId: string): void {
  if (!tenantId) {
    throw new ForbiddenException('Selecciona una empresa antes de acceder a este recurso');
  }
}

export function tenantWhere(tenantId: string, where: Record<string, any> = {}): Record<string, any> {
  assertTenant(tenantId);
  return { ...where, tenantId };
}

export function tenantData(tenantId: string, data: Record<string, any>): Record<string, any> {
  assertTenant(tenantId);
  return { ...data, tenantId };
}

export function parsePagination(query: Record<string, any> = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(query.limit) || 20));
  return { page, limit, skip: (page - 1) * limit, take: limit };
}

export function paginated<T>(items: T[], total: number, page: number, limit: number) {
  return {
    data: items,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}
