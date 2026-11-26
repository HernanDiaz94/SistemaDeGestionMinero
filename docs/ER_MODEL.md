# Modelo entidad-relación

Fuente de verdad: [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma). Migración inicial: `backend/prisma/migrations/20260101000000_init/migration.sql`.

## 1. Diagrama lógico (simplificado)

```
                      ┌──────────┐
                      │  users   │
                      └────┬─────┘
                           │ 1:N
                      ┌────▼─────────┐        ┌───────────────┐
   ┌──────────┐       │ tenant_users │───N:M──│     roles     │
   │ tenants  │──1:N──└────┬─────────┘        └──────┬────────┘
   └────┬─────┘             │                       │ N:M
        │                   │                 ┌─────▼────────┐
        │ 1:N               │                 │ permissions  │
        │                   │                 └──────────────┘
        │            ┌──────▼───────┐  ┌─────────────────┐
        ├───────────▶│   projects   │◀─│     shifts      │
        │            └──────┬───────┘  └─────────────────┘
        │                   │ 1:N
        │            ┌──────▼───────┐  ┌─────────────────┐
        ├───────────▶│    mines     │◀─│   mine_areas    │ (jerarquía++)
        │            └──────┬───────┘  └─────────────────┘
        │                   │ 1:N
        ├───────────▶┌──────▼────────┐  ┌──────────────┐
        │            │operation_     │◀─│  crews       │
        │            │reports        │  └──────┬───────┘
        │            └──┬──┬──┬──┬───┘         │ 1:N
        │               │  │  │  │      ┌──────▼───────┐
        │       ┌───────┘  │  │  └─────▶│  employees   │
        │       │          │  │         └──────────────┘
        │  ┌────▼──────┐ ┌──▼───────────┐ ┌─────────────────┐
        │  │production │ │report_       │ │report_employees │
        │  │_records   │ │equipment     │ └─────────────────┘
        │  └────┬──────┘ └──────┬───────┘
        │       │               │
        │  ┌────▼────────┐ ┌────▼───────┐
        │  │indicators   │ │ equipment  │◀── assignments / readings / fuel
        │  │units/targets│ └────────────┘
        │  └─────────────┘
        ├──▶ tenant_modules, subscriptions, audit_logs, notifications
        └──▶ operation_activities, report_attachments, report_approvals, report_revisions
```

## 2. Catálogo de entidades

### Plataforma (sin tenant)

| Entidad | Descripción | Claves |
| --- | --- | --- |
| `tenants` | Empresa cliente | `id`, `slug` único |
| `users` | Cuenta global de persona | `id`, `email` único |
| `tenant_users` | Membresía usuario↔empresa | único `(tenant_id, user_id)` |
| `roles` | Rol global (`tenant_id = NULL`) o propio del tenant | único `(tenant_id, key)` |
| `permissions` | Permiso atómico `modulo.accion` | `key` único |
| `role_permissions` | Relación rol↔permiso | único `(role_id, permission_id)` |
| `tenant_user_roles` | Roles asignados a una membresía | único `(tenant_user_id, role_id)` |
| `tenant_modules` | Módulos habilitados por empresa | único `(tenant_id, key)` |
| `subscriptions` | Plan y límites comerciales | `tenant_id` |
| `audit_logs` | Trazabilidad de acciones | índice `(tenant_id, created_at)` |

### Operación (todas con `tenant_id` obligatorio)

| Entidad | Descripción | Relación principal |
| --- | --- | --- |
| `projects` | Proyecto minero | `tenant_id`, código único por tenant |
| `mines` | Yacimiento | `project_id`, `mode` OPEN_PIT/UNDERGROUND |
| `mine_areas` | Sectores jerárquicos | `mine_id`, `parent_id`, `type` |
| `shifts` | Turnos | `project_id?` |
| `crews` | Cuadrillas | `project_id`, `shift_id?`, `supervisor_id?` |
| `employees` | Empleados/contratistas | `project_id?`, `crew_id?`, `shift_id?` |
| `equipment_categories` | Categorías de maquinaria | `tenant_id` |
| `equipment` | Maquinaria | `category_id?`, `project_id?`, `responsible_id?` |
| `equipment_assignments` | Asignaciones | `equipment_id`, `project_id?`, `employee_id?` |
| `equipment_readings` | Horómetro | `equipment_id`, `read_at` |
| `fuel_records` | Consumo de combustible | `equipment_id`, `date` |
| `production_units` | Unidades configurables | categoría MASS/VOLUME/LENGTH/TIME/COUNT |
| `production_indicators` | Indicadores configurables | `unit_id` |
| `production_targets` | Objetivos por período | `project_id`, `indicator_id`, `period` |
| `operation_reports` | Parte diario | `project_id`, `mine_id`, `area_id?`, `shift_id`, `status` |
| `operation_activities` | Actividades del parte | `report_id`, `area_id?` |
| `production_records` | Producción del parte | `report_id`, `indicator_id`, `unit_id` |
| `report_employees` | Personal participante | único `(report_id, employee_id)` |
| `report_equipment` | Maquinaria utilizada | único `(report_id, equipment_id)` |
| `report_attachments` | Fotos/documentos | `storage_key` |
| `report_approvals` | Decisiones de revisión | `reviewer_id`, `decision` |
| `report_revisions` | Historial de versiones | único `(report_id, version)` |
| `notifications` | Notificaciones por usuario | `user_id`, `read_at?` |

## 3. Estructura operativa por modalidad

`mine_areas.type` soporta ambas modalidades y el servicio valida compatibilidad con `mines.mode`:

| OPEN_PIT | UNDERGROUND | Común |
| --- | --- | --- |
| `BENCH` (bancos) | `LEVEL` (niveles) | `OTHER` |
| `PHASE` (fases) | `DRIFT` (galerías) | |
| `EXTRACTION_FRONT` (frentes de extracción) | `RAMP` (rampas) | |
| `HAUL_ROAD` (rutas de acarreo) | `ADVANCE_FRONT` (frentes de avance) | |

Ninguna estructura es obligatoria: cada empresa configura solo los sectores que necesita. `parent_id` permite agrupar (por ejemplo, frentes dentro de un banco o galerías dentro de un nivel).

## 4. Estados del parte diario

```
DRAFT ──submit──▶ SUBMITTED ──review──▶ UNDER_REVIEW
  ▲                   │                      │
  │                   └──────reject──────────┤
  │                                          ▼
  └──────────────────────────────────── APPROVED / REJECTED
```

- `APPROVED` es inmutable salvo rectificación con `rectificationReason`, que crea un `report_revision` y aumenta `version`.
- Los indicadores de producción solo consideran reportes `APPROVED` (evita duplicar al consolidar).

## 5. Índices y restricciones relevantes

- `@@unique([tenantId, code])` en proyectos, minas, áreas, turnos, cuadrillas, empleados, equipos, categorías, unidades, indicadores y reportes.
- `@@index([tenantId, status])`, `@@index([tenantId, projectId, date])`, `@@index([tenantId, indicatorId])`, etc.
- `onDelete: Cascade` desde `tenants` a todas sus tablas de negocio.
- `onDelete: SetNull` en referencias opcionales (manager, supervisor, responsable) para conservar trazabilidad.
- Todas las fechas se almacenan en UTC; los campos de fecha calendario usan `@db.Date`.

## 6. Reglas de integridad en base de datos

Además de las FKs, el SQL de inicialización incluye un trigger que impide mezclar tenants en relaciones críticas (por ejemplo, un yacimiento de otro proyecto). La aplicación también valida estas reglas antes de escribir. Ver `backend/prisma/migrations/20260101000000_init/migration.sql` y `docs/PERMISSIONS.md`.
