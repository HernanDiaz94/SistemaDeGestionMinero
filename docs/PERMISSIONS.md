# Permisos y aislamiento multi-tenant

## 1. Modelo de acceso

```
User (cuenta global)
  └── TenantUser (membresía por empresa, con estado)
        └── TenantUserRole → Role → RolePermission → Permission
```

- Un usuario puede pertenecer a varias empresas. Cada membresía tiene sus propios roles.
- Los roles del sistema tienen `tenantId = NULL` y no se pueden editar desde la UI. Una empresa puede crear roles propios.
- El JWT incluye `tenantId` y la lista plana de `permissions` de la membresía activa. Cambiar de empresa emite un nuevo token.
- `SUPERADMIN` bypassa los permisos y puede usar el panel global sin tenant activo. Para los módulos operativos debe activar una empresa con `/auth/switch-tenant` (o desde el selector superior); `/auth/me` le devuelve el catálogo completo de empresas.

## 2. Roles iniciales

| Rol | Alcance principal |
| --- | --- |
| `SUPERADMIN` | Panel global: empresas, roles, suscripciones. Acceso total. |
| `ADMIN_EMPRESARIAL` | Toda la configuración y operación de su empresa. |
| `GERENTE_OPERACIONES` | Visión operativa, revisión y aprobación de partes, objetivos y analítica. |
| `JEFE_PROYECTO` | Proyectos, yacimientos, sectores, cuadrillas, personal, partes y producción. |
| `SUPERVISOR` | Creación/edición/envío de partes, lectura operativa. |
| `OPERADOR` | Lectura operativa y creación de partes. |
| `RESPONSABLE_MAQUINARIA` | Maquinaria, lecturas, combustible y analítica de equipos. |
| `USUARIO_CONSULTA` | Solo lectura de módulos operativos y analítica. |

La definición exacta está en `backend/src/common/auth/permissions.ts` (`ROLE_PERMISSIONS`).

## 3. Catálogo de permisos

Formato `modulo.accion`. Módulos: `dashboard`, `projects`, `mines`, `areas`, `shifts`, `crews`, `employees`, `equipment`, `reports`, `production`, `analytics`, `users`, `roles`, `tenants`, `settings`, `audit`, `notifications`.

Acciones habituales: `read`, `create`, `update`, `delete`. Específicas:

- `equipment.readings.create`, `equipment.fuel.create`
- `reports.submit`, `reports.review`, `reports.approve`, `reports.export`
- `production.targets.read`, `production.targets.create`, `production.targets.update`
- `analytics.read`, `analytics.export`
- `settings.read`, `settings.update`

## 4. Aplicación en código

```ts
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('projects')
export class ProjectsController {
  @Post()
  @RequirePermissions('projects.create')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProjectDto) { ... }
}
```

```ts
async findAll(tenantId: string, query: any) {
  return this.prisma.project.findMany({ where: tenantWhere(tenantId, where) });
}

async create(tenantId: string, dto: CreateProjectDto) {
  return this.prisma.project.create({ data: tenantData(tenantId, dto) as any });
}
```

**Reglas duras:**

1. El `tenantId` del cuerpo de la petición se ignora (los DTO no lo aceptan).
2. Toda búsqueda por `id` incluye `tenantId` en el `where`; si no existe, se responde 404.
3. Antes de guardar una FK se verifica que el registro referenciado pertenezca al mismo tenant.
4. Las consultas agregadas de producción filtran por tenant y por `status: APPROVED`.

## 5. Aislamiento en PostgreSQL

- Todas las tablas de negocio tienen `"tenantId" TEXT NOT NULL` e índices compuestos que empiezan por `"tenantId"`.
- Claves únicas compuestas por tenant, p. ej. `@@unique([tenantId, code])` → `UNIQUE ("tenantId","code")`.
- `ON DELETE CASCADE` desde `tenant` evita huérfanos al eliminar una empresa.
- La migración `20260101000100_tenant_integrity` añade triggers `check_same_tenant()` que rechazan relaciones entre tenants distintos con `23514`.

Ejemplo de trigger:

```sql
CREATE TRIGGER trg_reports_mine_tenant BEFORE INSERT OR UPDATE ON "operation_report"
  FOR EACH ROW EXECUTE FUNCTION check_same_tenant('mine', 'mineId');
```

### Row Level Security (opcional, recomendado en producción)

Si se usa un rol de base de datos por tenant, se pueden activar políticas como:

```sql
ALTER TABLE "operation_report" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "operation_report"
  USING ("tenantId" = current_setting('app.current_tenant', true));
```

En el MVP no se activa por defecto porque Prisma usa un pool de conexiones compartido; el trigger + el filtro obligatorio en el servicio dan el aislamiento sin riesgo de fugas por conexión. Para activar RLS, configura un `PrismaClient` por tenant (datasource distinto con `SET app.current_tenant`) o un pooler con `SET LOCAL` por transacción.

## 6. Auditoría

`AuditService.log()` registra `CREATE`, `UPDATE`, `DELETE`, `SUBMIT`, `APPROVE`, `REJECT`, `LOGIN`, `LOGOUT` y `SWITCH_TENANT` con `tenantId`, actor, entidad, valores anterior/posterior, IP y user-agent. Endpoint de consulta: `GET /api/audit` (permiso `audit.read`).

Los partes aprobados no se editan: si se envía `PATCH` con `rectificationReason`, se crea un `report_revision` con snapshot y se incrementa `version`, manteniendo trazabilidad.
