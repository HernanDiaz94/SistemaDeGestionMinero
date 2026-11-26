import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';
import { TenantGuard } from './tenant.guard';
import { PermissionsGuard } from './permissions.guard';

@Module({
  imports: [PassportModule],
  providers: [JwtStrategy, JwtAuthGuard, TenantGuard, PermissionsGuard],
  exports: [JwtAuthGuard, TenantGuard, PermissionsGuard],
})
export class AuthCoreModule {}
