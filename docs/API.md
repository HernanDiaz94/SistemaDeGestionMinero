# API REST

Base URL: `/api`. Autenticación: `Authorization: Bearer <accessToken>` excepto `/auth/login` y `/auth/refresh`.

Documentación interactiva (Swagger): `http://localhost:3001/api/docs`.

## Convenciones

- JSON UTF-8. Fechas en ISO-8601 UTC (`2026-05-21T00:00:00.000Z`); fechas calendario `YYYY-MM-DD`.
- Listados: `?page=1&limit=20` → `{ data: [...], meta: { total, page, limit, totalPages } }`.
- Errores: `{ statusCode, message, path, timestamp }`.
- Códigos: 400 validación/regla de negocio, 401 no autenticado, 403 sin permiso/tenant, 404 no encontrado u otro tenant, 409 duplicado, 429 throttling, 500 error inesperado.
- Ningún endpoint acepta `tenantId`: se deriva del JWT.

---

## Autenticación

| Método | Ruta | Permiso | Descripción |
| --- | --- | --- | --- |
| POST | `/auth/login` | público | `{email,password,tenantSlug?}` → tokens + usuario + empresas |
| POST | `/auth/refresh` | público | `{refreshToken}` → nuevos tokens |
| POST | `/auth/switch-tenant` | JWT | `{tenantSlug}` → tokens con permisos del tenant |
| GET | `/auth/me` | JWT | Perfil, empresa activa, roles, permisos |
| POST | `/auth/change-password` | JWT | `{currentPassword,newPassword}` |

## Panel global / plataforma

| Método | Ruta | Permiso | Descripción |
| --- | --- | --- | --- |
| GET | `/tenants` | `tenants.read` | Listado paginado de empresas |
| POST | `/tenants` | `tenants.create` | Crear empresa (acepta `adminEmail`, `adminPassword`, `modules`) |
| GET | `/tenants/:id` | `tenants.read` | Detalle con módulos, suscripción y conteos |
| PATCH | `/tenants/:id` | `tenants.update` | Editar empresa |
| DELETE | `/tenants/:id` | `tenants.delete` | Eliminar empresa y datos asociados |
| GET | `/tenants/:id/modules` | `settings.read` | Módulos habilitados |
| PUT | `/tenants/:id/modules` | `settings.update` | `{key, enabled}` |
| POST | `/tenants/:id/subscriptions` | `tenants.update` | Alta de suscripción |
| GET | `/tenants/:id/roles` | `roles.read` | Roles globales y del tenant |
| POST | `/tenants/:id/users/:tenantUserId/roles` | `users.update` | Asignar rol |
| GET | `/permissions` | `roles.read` | Catálogo de permisos |
| POST | `/tenants/seed-system` | `tenants.create` | (Re)crear permisos y roles del sistema |

## Usuarios

| Método | Ruta | Permiso |
| --- | --- | --- |
| GET | `/users` | `users.read` |
| POST | `/users` | `users.create` |
| GET | `/users/:id` | `users.read` |
| PATCH | `/users/:id` | `users.update` |
| DELETE | `/users/:id` | `users.delete` |

`POST/PATCH` aceptan `email`, `password`, `firstName`, `lastName`, `globalRole`, `status`, `roleKeys[]`.

## Proyectos y yacimientos

| Método | Ruta | Permiso |
| --- | --- | --- |
| GET/POST | `/projects` | `projects.read` / `projects.create` |
| GET/PATCH/DELETE | `/projects/:id` | `projects.read` / `projects.update` / `projects.delete` |
| GET | `/projects/:id/mines` | `projects.read` |
| GET | `/projects/:id/stats` | `projects.read` |
| GET/POST | `/mines` | `mines.read` / `mines.create` |
| GET/PATCH/DELETE | `/mines/:id` | `mines.read` / `mines.update` / `mines.delete` |
| GET/POST | `/areas?mineId=&type=` | `areas.read` / `areas.create` |
| GET | `/areas/tree?mineId=` | `areas.read` |
| GET/PATCH/DELETE | `/areas/:id` | `areas.read` / `areas.update` / `areas.delete` |
| GET/POST | `/shifts` | `shifts.read` / `shifts.create` |
| GET/PATCH/DELETE | `/shifts/:id` | `shifts.read` / `shifts.update` / `shifts.delete` |
| GET/POST | `/crews` | `crews.read` / `crews.create` |
| GET/PATCH/DELETE | `/crews/:id` | `crews.read` / `crews.update` / `crews.delete` |

`mines.mode`: `OPEN_PIT` | `UNDERGROUND`.
`areas.type`: `BENCH`, `PHASE`, `EXTRACTION_FRONT`, `HAUL_ROAD`, `LEVEL`, `DRIFT`, `RAMP`, `ADVANCE_FRONT`, `OTHER`. El backend valida compatibilidad con la modalidad del yacimiento.

## Personal

| Método | Ruta | Permiso |
| --- | --- | --- |
| GET/POST | `/employees?projectId=&type=&status=&search=` | `employees.read` / `employees.create` |
| GET | `/employees/stats` | `employees.read` |
| GET/PATCH/DELETE | `/employees/:id` | `employees.read` / `employees.update` / `employees.delete` |

`type`: `EMPLOYEE` | `CONTRACTOR`. Campos: `code`, `firstName`, `lastName`, `documentType`, `documentNumber`, `email`, `phone`, `position`, `company`, `projectId`, `crewId`, `shiftId`, `status`, `hiredAt`, `documents`.

## Maquinaria

| Método | Ruta | Permiso |
| --- | --- | --- |
| GET/POST | `/equipment?status=&projectId=` | `equipment.read` / `equipment.create` |
| GET | `/equipment/stats` | `equipment.read` |
| GET/PATCH/DELETE | `/equipment/:id` | `equipment.read` / `equipment.update` / `equipment.delete` |
| GET/POST | `/equipment/categories` | `equipment.read` / `equipment.create` |
| GET/PATCH/DELETE | `/equipment/categories/:id` | `equipment.read` / `equipment.update` / `equipment.delete` |
| GET/POST | `/equipment/:id/readings` | `equipment.read` / `equipment.readings.create` |
| GET/POST | `/equipment/:id/fuel` | `equipment.read` / `equipment.fuel.create` |

## Partes diarios

| Método | Ruta | Permiso | Descripción |
| --- | --- | --- | --- |
| GET/POST | `/reports` | `reports.read` / `reports.create` | Listar/crear parte anidado |
| GET/PATCH/DELETE | `/reports/:id` | `reports.read` / `reports.update` / `reports.delete` | Detalle/edición/borrado |
| POST | `/reports/:id/submit` | `reports.submit` | DRAFT/REJECTED → SUBMITTED |
| POST | `/reports/:id/review` | `reports.review` | SUBMITTED → UNDER_REVIEW |
| POST | `/reports/:id/approve` | `reports.approve` | → APPROVED + ReportApproval |
| POST | `/reports/:id/reject` | `reports.approve` | `{comments}` → REJECTED |
| GET | `/reports/:id/revisions` | `reports.read` | Historial de versiones |
| POST | `/reports/:id/attachments` | `reports.update` | Multipart `file` |
| GET/DELETE | `/reports/:id/attachments[/:attachmentId]` | `reports.read` / `reports.update` | Evidencias |
| GET | `/reports/files/*key` | JWT | Descarga segura (solo archivos del tenant; la clave incluye barras) |

`POST /reports` ejemplo:

```json
{
  "projectId": "...",
  "mineId": "...",
  "areaId": "...",
  "shiftId": "...",
  "date": "2026-05-21",
  "observations": "Sin novedades",
  "activities": [
    { "areaId": "...", "description": "Extracción", "startAt": "2026-05-21T07:00:00Z", "endAt": "2026-05-21T15:00:00Z", "hours": 8 }
  ],
  "production": [{ "indicatorId": "...", "unitId": "...", "value": 450 }],
  "employees": [{ "employeeId": "...", "hours": 8, "role": "Operación" }],
  "equipment": [{ "equipmentId": "...", "hours": 7.5, "fuelLiters": 160 }]
}
```

Estados: `DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `APPROVED`, `REJECTED`. Un parte aprobado solo se modifica con `rectificationReason`; se guarda un snapshot en `report_revisions`.

## Producción

| Método | Ruta | Permiso |
| --- | --- | --- |
| GET/POST | `/production/units` | `production.read` / `production.create` |
| GET/PATCH/DELETE | `/production/units/:id` | `production.read` / `production.update` / `production.delete` |
| GET/POST | `/production/indicators` | `production.read` / `production.create` |
| GET/PATCH/DELETE | `/production/indicators/:id` | `production.read` / `production.update` / `production.delete` |
| GET/POST | `/production/targets` | `production.targets.read` / `production.targets.create` |
| GET/PATCH/DELETE | `/production/targets/:id` | `production.targets.read` / `production.targets.update` / `production.delete` |
| GET | `/production/records?reportId=&indicatorId=&from=&to=` | `production.read` |
| GET | `/production/summary?from=&to=&projectId=&indicatorId=` | `production.read` |
| GET | `/production/units/compatible?category=MASS` | `production.read` |

`/production/summary` consolida únicamente reportes `APPROVED` y convierte a unidad base con `factorToBaseUnit`.

## Dashboard y reportes

| Método | Ruta | Permiso | Descripción |
| --- | --- | --- | --- |
| GET | `/dashboard?projectId=&mineId=&areaId=&from=&to=` | `dashboard.read` | KPIs y series operativas |
| GET | `/analytics/production-by-project` | `analytics.read` | Producción por proyecto |
| GET | `/analytics/production-by-mine` | `analytics.read` | Producción por yacimiento |
| GET | `/analytics/production-by-shift` | `analytics.read` | Producción por turno |
| GET | `/analytics/production-by-activity` | `analytics.read` | Producción por actividad |
| GET | `/analytics/equipment-performance` | `analytics.read` | Rendimiento de maquinaria |
| GET | `/analytics/equipment-hours` | `analytics.read` | Horas de funcionamiento |
| GET | `/analytics/crew-activity` | `analytics.read` | Actividad por cuadrilla |
| GET | `/analytics/reports` | `analytics.read` | Partes diarios agregados |
| GET | `/analytics/targets-vs-actual` | `analytics.read` | Objetivos vs resultados |
| GET | `/analytics/export?type=production-by-project&format=csv\|xlsx` | `analytics.export` | Descarga real |
| GET | `/audit?action=&entityType=&from=&to=` | `audit.read` | Trazabilidad |
| GET | `/notifications` | `notifications.read` | Notificaciones del usuario |
| POST | `/notifications/:id/read` | `notifications.read` | Marcar como leída |
