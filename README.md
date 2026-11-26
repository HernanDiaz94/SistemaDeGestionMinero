# Mining Manager — MVP

Plataforma SaaS multiempresa para la gestión operativa de compañías mineras (cielo abierto y subterránea). Monolito modular con frontend Next.js, backend NestJS, PostgreSQL + Prisma, almacenamiento S3 compatible y aislamiento por tenant.

## Estado del MVP

Módulos incluidos: autenticación JWT, administración multiempresa, usuarios y permisos, proyectos, yacimientos, estructuras operativas, personal y cuadrillas, maquinaria, partes diarios, producción, aprobaciones, dashboard, reportes/exportación y auditoría.

No incluidos (fuera del MVP): telemetría, GPS, sensores, integraciones externas. La carga operativa es manual.

## Arranque rápido

```bash
cp .env.example .env
docker compose up -d
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npm run db:seed
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001/api
- Swagger: http://localhost:3001/api/docs
- MinIO: http://localhost:9001

### Desarrollo local (sin Docker)

Requiere PostgreSQL 16 en `localhost:5432` y Node 22+.

```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

## Credenciales de demostración

Solo para entorno de demostración. Cambiar contraseñas en producción.

| Usuario | Contraseña | Rol |
| --- | --- | --- |
| `superadmin@miningmanager.com.ar` | `Demo1234!` | Superadministrador (panel global) |
| `admin@mineraaurora.com.ar` | `Demo1234!` | Administrador empresarial |
| `supervisor@mineraaurora.com.ar` | `Demo1234!` | Supervisor |
| `operador@mineraaurora.com.ar` | `Demo1234!` | Operador |
| `admin@andescopper.com.ar` | `Demo1234!` | Administrador empresarial |

## Documentación

- [Arquitectura](docs/ARCHITECTURE.md)
- [Modelo entidad-relación](docs/ER_MODEL.md)
- [Permisos y aislamiento multi-tenant](docs/PERMISSIONS.md)
- [API REST](docs/API.md)
- [Desarrollo y despliegue](docs/DEVELOPMENT.md)
- [Reglas de negocio](docs/BUSINESS_RULES.md)

## Estructura

```
backend/   NestJS + Prisma (monolito modular)
frontend/  Next.js App Router + Tailwind + componentes estilo shadcn/ui
docs/      Arquitectura, ER, permisos, APIs y operación
```

## Comandos útiles

```bash
npm run dev              # backend + frontend en paralelo
npm run build            # compila ambos paquetes
npm test                 # pruebas unitarias del backend
npm run test:e2e         # pruebas HTTP (requiere API en marcha y semilla aplicada)
npm run smoke            # verificación end-to-end de API, reportes, exports y archivos
npm run db:migrate       # migración de desarrollo (Prisma)
npm run db:seed          # datos ficticios de demostración
```
