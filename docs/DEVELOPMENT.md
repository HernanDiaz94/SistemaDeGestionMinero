# Desarrollo y despliegue

## Requisitos

- Node.js 22+ y npm 11+
- PostgreSQL 16 (o Docker Compose)
- Docker con Compose v2 para el entorno completo (incluye MinIO)

## Arranque con Docker

```bash
cp .env.example .env
docker compose up -d --build
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npm run db:seed
```

Servicios:

| Servicio | URL | Credenciales |
| --- | --- | --- |
| Frontend | http://localhost:3000 | — |
| API | http://localhost:3001/api | — |
| Swagger | http://localhost:3001/api/docs | — |
| MinIO | http://localhost:9001 | `minioadmin` / `minioadmin` |

## Arranque local

1. Crear base de datos `mining_manager` con usuario `mining`.
2. `cp .env.example .env` y ajustar `DATABASE_URL`.
3. `npm install`
4. `npm run db:migrate && npm run db:seed`
5. `npm run dev`

## Prisma

```bash
npm run db:migrate          # desarrollo: crea/aplica migración
npm run db:deploy           # producción: solo aplica migraciones
npm run db:seed             # datos ficticios de demostración
npx prisma studio --schema=backend/prisma/schema.prisma
```

Tras cambiar `schema.prisma`, ejecutar `npx prisma generate --schema=backend/prisma/schema.prisma`.

## Pruebas

```bash
npm test          # unitarias
npm run test:e2e  # HTTP contra la API en ejecución
npm run smoke     # API + exportación + adjuntos
```

Las pruebas unitarias cubren helpers de tenant, guard de permisos, validaciones de reglas de negocio y servicios. Las pruebas e2e y el smoke validan autenticación, aprobación de partes, aislamiento entre empresas, exportaciones y archivos.

## Variables de entorno

Ver `.env.example`. Críticas en producción:

- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`: al menos 32 caracteres aleatorios, distintos entre sí.
- `DATABASE_URL`: cadena de conexión SSL de la base administrada.
- `S3_*`: bucket real, endpoint regional y credenciales del gestor de secretos.
- `CORS_ORIGIN`: dominio público del frontend (separado por comas si hay varios).
- `NEXT_PUBLIC_API_URL`: URL pública de la API.

## Despliegue en cloud

1. Base de datos administrada PostgreSQL 16 con backups y SSL.
2. Bucket S3 privado con política de acceso controlado; usar URLs firmadas si se quiere evitar ACL pública.
3. Backend: contenedor `backend/Dockerfile`, `prisma migrate deploy` en el arranque, secretos inyectados, healthcheck `/api/docs`.
4. Frontend: contenedor `frontend/Dockerfile` (output standalone) o plataforma serverless compatible con Next.js.
5. Ingress con TLS y rate limiting; el backend ya incluye throttler (120 req/min) y helmet.
6. Rotar credenciales demo antes de exponer el servicio.

## Convenciones de código

- Un módulo = carpeta con `module.ts`, `controller.ts`, `service.ts`, `dto/`.
- Los servicios nunca reciben `tenantId` del cliente.
- Los DTO validan y transforman con `class-validator`/`class-transformer`.
- Las mutaciones registran auditoría.
- Los errores de regla de negocio lanzan `BadRequestException` con mensaje en español.

## Solución de problemas

| Síntoma | Causa probable | Acción |
| --- | --- | --- |
| `Environment variable not found: DATABASE_URL` | Falta `.env` en `backend/` o en la raíz | Copiar `.env.example` a `.env` y a `backend/.env` |
| `P1001` al conectar | PostgreSQL no está listo | `docker compose ps` y revisar healthcheck |
| 403 “Selecciona una empresa activa” | Token sin tenant | Hacer login con `tenantSlug` o `/auth/switch-tenant`. Si eres superadmin, usa el selector “Selecciona empresa” en la barra superior |
| 403 “Permisos insuficientes” | Rol sin permiso | Asignar rol desde Configuración o panel global |
| Adjuntos no descargan | S3 mal configurado | Revisar `S3_*` y `S3_PUBLIC_URL` |
