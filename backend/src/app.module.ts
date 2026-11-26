import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthCoreModule } from './common/auth/auth.module';
import { JwtAuthGuard } from './common/auth/jwt-auth.guard';
import { PermissionsGuard } from './common/auth/permissions.guard';
import { TenantGuard } from './common/auth/tenant.guard';
import { AuditModule } from './common/audit/audit.module';
import { AuditController } from './common/audit/audit.controller';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { PrismaModule } from './common/prisma/prisma.module';
import { StorageModule } from './common/storage/storage.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AreasModule } from './modules/areas/areas.module';
import { AuthModule } from './modules/auth/auth.module';
import { CrewsModule } from './modules/crews/crews.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { EquipmentModule } from './modules/equipment/equipment.module';
import { MinesModule } from './modules/mines/mines.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ProductionModule } from './modules/production/production.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { ReportsModule } from './modules/reports/reports.module';
import { ShiftsModule } from './modules/shifts/shifts.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../.env', '.env'] }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    PrismaModule,
    AuditModule,
    StorageModule,
    AuthCoreModule,
    AuthModule,
    TenantsModule,
    UsersModule,
    ProjectsModule,
    MinesModule,
    AreasModule,
    ShiftsModule,
    CrewsModule,
    EmployeesModule,
    EquipmentModule,
    ReportsModule,
    ProductionModule,
    DashboardModule,
    AnalyticsModule,
    NotificationsModule,
  ],
  controllers: [AuditController],
  providers: [
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
