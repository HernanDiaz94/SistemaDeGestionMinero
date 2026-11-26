# Reglas de negocio

| # | Regla | Dónde se aplica |
| --- | --- | --- |
| 1 | Todo registro operativo pertenece a un tenant y el `tenantId` se obtiene del JWT. | Guards + helpers `tenantWhere`/`tenantData` + triggers PostgreSQL |
| 2 | Los proyectos pertenecen a una empresa. | `Project.tenantId` NOT NULL |
| 3 | Los yacimientos están vinculados a un proyecto del mismo tenant. | Servicio `mines` + trigger `trg_mines_project_tenant` |
| 4 | Las operaciones (partes) están asociadas a proyecto y yacimiento. | `OperationReport.projectId/mineId` NOT NULL |
| 5 | Los sectores corresponden a la estructura de su yacimiento y a su modalidad. | Servicio `areas` valida `Mine.mode` vs `AreaType` + trigger |
| 6 | Todo parte registra al usuario responsable. | `OperationReport.supervisorUserId` NOT NULL; por defecto usuario autenticado |
| 7 | No se puede aprobar un parte sin permiso `reports.approve`. | `PermissionsGuard` + servicio `reports` |
| 8 | Un parte aprobado no se modifica sin rectificación auditada. | Servicio `reports`: exige `rectificationReason`, crea `ReportRevision` e incrementa `version` |
| 9 | La producción no se duplica al consolidar. | `production/summary`, dashboard y analytics solo consideran reportes `APPROVED` |
| 10 | Las unidades deben ser compatibles con el indicador. | Servicio `reports`: `indicator.unitId === unitId` o misma categoría con factor equivalente |
| 11 | Se mantiene trazabilidad de las operaciones. | `AuditService`, `ReportApproval`, `ReportRevision` |
| 12 | Fechas en UTC, presentación según `tenant.timezone`. | Prisma `DateTime` UTC; `/auth/me` entrega `timezone` al frontend |
| 13 | Unidades e indicadores son configurables por empresa. | `ProductionUnit`, `ProductionIndicator` por tenant |
| 14 | No se obliga a usar todas las estructuras operativas. | `MineArea` es opcional y jerárquica |
| 15 | Empleados, maquinaria y actividades de un parte no se duplican. | `@@unique([reportId, employeeId])` y `@@unique([reportId, equipmentId])` |
| 16 | El código de parte, proyecto, yacimiento, etc. es único dentro de la empresa. | `@@unique([tenantId, code])` |
| 17 | Un usuario solo ve datos de las empresas a las que pertenece. | `TenantUser`, JWT con `tenantId`, switch-tenant, filtros en servicios |
| 18 | Los archivos adjuntos están namespaceados por tenant. | Claves `<tenantId>/reports/...` y verificación en `/files/:key` |
