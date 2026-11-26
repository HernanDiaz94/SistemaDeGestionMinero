# Arquitectura de Mining Manager

## 1. Visión general

Monolito modular multi-tenant desplegado como dos aplicaciones (backend NestJS y frontend Next.js) sobre PostgreSQL. No hay microservicios en el MVP. Los módulos de negocio comparten el mismo núcleo transversal (autenticación, tenant, permisos, auditoría, almacenamiento), de forma que se puedan añadir módulos sin reconstruir el sistema.

```
                    ┌──────────────────────┐
   Navegador  ─────▶│  Next.js (SSR/CSR)   │
                    │  Tailwind + shadcn   │
                    └──────────┬───────────┘
                               │ REST / JSON + JWT Bearer
                    ┌──────────▼───────────┐
                    │     API Gateway      │  (NGINX / Ingress en cloud)
                    └──────────┬───────────┘
                    ┌──────────▼───────────┐
                    │  NestJS Monolito     │
                    │  Módulos de negocio  │
                    │  Guards + Prisma     │
                    └──────┬───────┬───────┘
                           │       │
                  ┌────────▼──┐  ┌─▼────────────┐
                  │ PostgreSQL│  │ S3 compatible│
                  │ ( tenants │  │ (fotos/docs) │
                  │  + datos) │  └──────────────┘
                  └───────────┘
```

## 2. Separación de responsabilidades

| Capa | Tecnología | Responsabilidad |
| --- | --- | --- |
| Presentación | Next.js 16, React 19, TypeScript, Tailwind 4 | UI responsive, formularios, tablas, gráficos, sesión JWT en cliente |
| API | NestJS 11, TypeScript | Controladores REST, validación DTO, permisos, reglas de negocio, auditoría |
| Persistencia | PostgreSQL 16 + Prisma 6 | Modelo relacional, migraciones, transacciones, índices por tenant |
| Archivos | S3 compatible (MinIO en dev) | Fotografías y documentos de partes diarios |
| Infraestructura | Docker Compose / cloud | Contenedores, volúmenes, variables de entorno |

## 3. Módulos del monolito

**Núcleo transversal**

- `common/prisma`: cliente Prisma y ciclo de vida.
- `common/auth`: estrategia JWT, guard de autenticación, guard de tenant, guard de permisos, decoradores.
- `common/audit`: servicio central de trazabilidad.
- `common/storage`: adaptador S3 / sistema de archivos local.
- `common/tenant`: helpers `tenantWhere`, `tenantData`, paginación.

**Dominio**

| Módulo | Entidades principales |
| --- | --- |
| `auth` | login, refresh, switch-tenant, perfil, cambio de contraseña |
| `tenants` | tenants, tenant_modules, subscriptions, roles, permissions, panel global |
| `users` | users, tenant_users, tenant_user_roles |
| `projects` | projects |
| `mines` | mines |
| `areas` | mine_areas (cielo abierto y subterráneo) |
| `shifts`, `crews` | shifts, crews |
| `employees` | employees |
| `equipment` | equipment, categories, assignments, readings, fuel_records |
| `reports` | operation_reports, activities, attachments, approvals, revisions |
| `production` | units, indicators, records, targets |
| `dashboard` | indicadores agregados en tiempo real desde BD |
| `analytics` | reportes y exportación CSV/XLSX |
| `notifications` | notificaciones por usuario |

## 4. Flujo de una petición

1. El frontend envía `Authorization: Bearer <access_token>`.
2. `JwtAuthGuard` valida firma, expiración y carga `AuthUser` (`userId`, `tenantId`, `permissions`, `globalRole`).
3. `TenantGuard` exige tenant activo salvo SUPERADMIN; los helpers `tenantWhere`/`tenantData` siguen exigiéndolo para datos operativos.
4. `PermissionsGuard` compara los permisos requeridos por el decorador `@RequirePermissions`.
5. El servicio aplica `tenantWhere(tenantId, where)` a **toda** consulta y `tenantData(tenantId, data)` a **toda** creación.
6. Las mutaciones registran `AuditLog`.
7. `HttpExceptionFilter` normaliza errores (400/401/403/404/409/500) sin exponer stack traces.

## 5. Autenticación

- Access token JWT de corta duración (15 min) con `tenantId` y `permissions` del rol activo.
- Refresh token de larga duración (7 días) para renovar sesión.
- Contraseñas hasheadas con bcrypt (factor 10).
- `POST /auth/switch-tenant` emite un nuevo par de tokens con los permisos del tenant seleccionado.
- El panel global del superadministrador funciona sin tenant activo. Los módulos operativos siempre exigen tenant: el frontend muestra una pantalla de selección y el superadministrador obtiene una membresía virtual para la empresa elegida.
- La migración futura a OIDC se limita al módulo `auth`: el resto consume `AuthUser`.

## 6. Aislamiento multi-tenant

- `tenant_id` es obligatorio (`NOT NULL`) en todas las tablas de negocio.
- Índices compuestos `(tenant_id, ...)` y restricciones únicas por tenant.
- El `tenant_id` nunca se recibe del cliente: se obtiene del token verificado.
- Las relaciones se validan en el servicio antes de persistir (proyecto, yacimiento, sector, turno, indicador, unidad, empleado, equipo).
- Las consultas agregadas (dashboard, analytics, producción) filtran por tenant y usan solo reportes `APPROVED`.
- Defensa en profundidad opcional en PostgreSQL: políticas RLS por rol de tenant (ver `docs/PERMISSIONS.md`).

## 7. Almacenamiento de archivos

`StorageService` elige adaptador según `S3_ENDPOINT`:

- Configurado: S3 compatible (MinIO en desarrollo), claves `<tenantId>/reports/<uuid>.<ext>`.
- No configurado: sistema de archivos local bajo `UPLOAD_DIR`, sirviendo por `/api/files/<key>` con verificación de prefijo de tenant.

## 8. Zonas horarias

- Persistencia en UTC (`DateTime` / `@db.Date`).
- Cada tenant define `timezone` (por defecto `UTC`); el frontend recibe el valor en `/auth/me` y está preparado para presentar fechas en esa zona.
- Los filtros de fecha enviados a la API son ISO-8601 UTC.

## 9. Escalabilidad y nuevos módulos

- Un nuevo módulo se añade como carpeta con `module/controller/service/dto`, se registra en `AppModule` y se agrega su clave a `PERMISSION_MATRIX`. El núcleo no cambia.
- El frontend usa un cliente API genérico y componentes de tabla/formulario reutilizables.
- Para pasar a micros servidos por separado, los módulos ya están desacoplados por interfaces de servicio; no es necesario en el MVP.

## 10. Despliegue

`docker-compose.yml` define PostgreSQL, MinIO, backend y frontend. En cloud se recomendan: base de datos administrada, bucket S3, contenedores del backend/frontend en un servicio de contenedores, secretos en el gestor de secretos y TLS en el ingress. Ver `docs/DEVELOPMENT.md`.
