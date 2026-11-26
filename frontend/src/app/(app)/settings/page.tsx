'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { KeyRound, Pencil, Plus, RefreshCw, Shield, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { PageHeader } from '@/components/shared/page-header';
import { ResourceTable, StatusCell, type Column } from '@/components/shared/resource-table';
import { FormModal, field, type FormField, type FormValues } from '@/components/shared/form-modal';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { useApiList } from '@/hooks/use-api';
import { useAuth } from '@/lib/auth';
import { api, type AuditLog, type Permission, type Role, type SystemUser, type Tenant, type TenantModule } from '@/lib/api';
import { listOf } from '@/lib/utils';
import { formatDateTime, label } from '@/lib/format';

type Tab = 'company' | 'modules' | 'users' | 'roles' | 'audit' | 'password';

const MODULES = ['DASHBOARD', 'PROJECTS', 'MINES', 'OPERATIONS', 'PRODUCTION', 'EQUIPMENT', 'PERSONNEL', 'REPORTS', 'SETTINGS'];
const TENANT_STATUSES = ['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED'].map((value) => ({ value, label: label(value) }));
const USER_STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED'].map((value) => ({ value, label: label(value) }));
const GLOBAL_ROLES = ['ADMIN', 'USER'].map((value) => ({ value, label: label(value) }));

export default function SettingsPage() {
  const { user, isSuperAdmin, refreshMe } = useAuth();
  const { success, error: toastError } = useToast();
  const [tab, setTab] = useState<Tab>('company');
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [tenantLoading, setTenantLoading] = useState(true);
  const [tenantError, setTenantError] = useState<string | null>(null);
  const [modules, setModules] = useState<TenantModule[]>([]);
  const [moduleLoading, setModuleLoading] = useState(true);
  const [userModal, setUserModal] = useState<SystemUser | null | undefined>(undefined);
  const [deleteUser, setDeleteUser] = useState<SystemUser | null>(null);
  const [search, setSearch] = useState('');
  const [auditFrom, setAuditFrom] = useState('');
  const [auditTo, setAuditTo] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const users = useApiList<SystemUser>(tab === 'users' ? '/users' : null);
  const roles = useApiList<Role>(tab === 'roles' && user?.tenantId ? `/tenants/${user.tenantId}/roles` : null);
  const [permissionList, setPermissionList] = useState<Permission[]>([]);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const audits = useApiList<AuditLog>(tab === 'audit' ? '/audit' : null, { from: auditFrom, to: auditTo });

  const tenantId = user?.tenantId;

  useEffect(() => {
    if (!tenantId) {
      setTenantLoading(false);
      return;
    }
    const controller = new AbortController();
    setTenantLoading(true);
    setTenantError(null);
    api.get<Tenant>(`/tenants/${tenantId}`, undefined, controller.signal)
      .then((response) => { if (!controller.signal.aborted) setTenant(response); })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setTenantError(err instanceof Error ? err.message : 'No se pudo cargar la empresa');
      })
      .finally(() => { if (!controller.signal.aborted) setTenantLoading(false); });
    return () => controller.abort();
  }, [tenantId]);

  useEffect(() => {
    if (tab !== 'roles') return;
    const controller = new AbortController();
    api.get<unknown>('/permissions', undefined, controller.signal)
      .catch(() => api.get<unknown>('/tenants/permissions', undefined, controller.signal))
      .then((response) => {
        if (!controller.signal.aborted) setPermissionList(listOf<Permission>(response));
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setPermissionError(err instanceof Error ? err.message : 'No se pudieron cargar los permisos');
      });
    return () => controller.abort();
  }, [tab]);

  useEffect(() => {
    if (!tenantId) {
      setModuleLoading(false);
      return;
    }
    const controller = new AbortController();
    setModuleLoading(true);
    api.get<unknown>(`/tenants/${tenantId}/modules`, undefined, controller.signal)
      .then((response) => { if (!controller.signal.aborted) setModules(listOf<TenantModule>(response)); })
      .catch(() => { if (!controller.signal.aborted) setModules([]); })
      .finally(() => { if (!controller.signal.aborted) setModuleLoading(false); });
    return () => controller.abort();
  }, [tenantId]);

  async function saveTenant(event: FormEvent) {
    event.preventDefault();
    if (!tenantId || !tenant) return;
    try {
      await api.put(`/tenants/${tenantId}`, {
        name: tenant.name,
        legalName: tenant.legalName || null,
        taxId: tenant.taxId || null,
        timezone: tenant.timezone || 'UTC',
        status: tenant.status,
      });
      success('Datos de empresa actualizados', tenant.name);
      await refreshMe();
    } catch (err) {
      toastError('No se pudo actualizar la empresa', err instanceof Error ? err.message : undefined);
    }
  }

  async function toggleModule(key: string, enabled: boolean) {
    if (!tenantId) return;
    setModules((current) => current.map((module) => module.key === key ? { ...module, enabled } : { key, enabled }));
    try {
      await api.put(`/tenants/${tenantId}/modules`, { key, enabled });
      success('Módulo actualizado', `${label(key)}: ${enabled ? 'activado' : 'desactivado'}`);
    } catch (err) {
      setModules((current) => current.map((module) => module.key === key ? { ...module, enabled: !enabled } : module));
      toastError('No se pudo actualizar el módulo', err instanceof Error ? err.message : undefined);
    }
  }

  async function saveUser(values: FormValues) {
    if (!userModal) {
      await api.post('/users', {
        email: String(values.email),
        password: String(values.password),
        firstName: String(values.firstName),
        lastName: String(values.lastName),
        globalRole: String(values.globalRole),
        roleKeys: values.roleKeys ? String(values.roleKeys).split(',').map((s) => s.trim()).filter(Boolean) : [],
      });
      success('Usuario creado', String(values.email));
    } else {
      await api.patch(`/users/${userModal.id}`, {
        firstName: String(values.firstName),
        lastName: String(values.lastName),
        status: String(values.status),
        ...(values.password ? { password: String(values.password) } : {}),
      });
      success('Usuario actualizado', String(values.email ?? userModal.email));
    }
    setUserModal(undefined);
    users.reload();
  }

  async function removeUser() {
    if (!deleteUser) return;
    try {
      await api.delete(`/users/${deleteUser.id}`);
      success('Usuario eliminado', deleteUser.email);
      users.reload();
    } catch (err) {
      toastError('No se pudo eliminar el usuario', err instanceof Error ? err.message : undefined);
      throw err;
    }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    setPasswordError(null);
    if (passwordForm.newPassword !== passwordForm.confirm) {
      setPasswordError('La nueva contraseña y su confirmación no coinciden.');
      return;
    }
    setPasswordSaving(true);
    try {
      await api.post('/auth/change-password', { currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword });
      success('Contraseña actualizada');
      setPasswordForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'No se pudo cambiar la contraseña');
    } finally {
      setPasswordSaving(false);
    }
  }

  const userColumns: Array<Column<SystemUser>> = [
    { key: 'name', header: 'Usuario', render: (row) => <div><p className="font-semibold">{row.firstName} {row.lastName}</p><p className="text-xs text-slate-400">{row.email}</p></div> },
    { key: 'role', header: 'Rol global', render: (row) => <Badge variant={row.globalRole === 'ADMIN' ? 'warning' : 'neutral'}>{label(row.globalRole)}</Badge> },
    { key: 'roles', header: 'Roles asignados', render: (row) => row.roles?.length ? row.roles.map((r) => <Badge key={r.key} variant="outline" className="mr-1">{r.name}</Badge>) : '—' },
    { key: 'status', header: 'Estado', render: (row) => <StatusCell value={row.status} /> },
    { key: 'lastLogin', header: 'Último acceso', render: (row) => formatDateTime(row.lastLoginAt) },
    {
      key: 'actions',
      header: 'Acciones',
      render: (row) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" onClick={() => setUserModal(row)} aria-label="Editar"><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="text-red-500" onClick={() => setDeleteUser(row)} aria-label="Eliminar"><Trash2 className="h-4 w-4" /></Button>
        </div>
      ),
    },
  ];

  const auditColumns: Array<Column<AuditLog>> = [
    { key: 'date', header: 'Fecha', render: (row) => formatDateTime(row.createdAt) },
    { key: 'action', header: 'Acción', render: (row) => <Badge variant="outline">{label(row.action)}</Badge> },
    { key: 'entity', header: 'Entidad', render: (row) => `${label(row.entityType)} ${row.entityId ? `(${row.entityId.slice(0, 8)})` : ''}` },
    { key: 'actor', header: 'Usuario', render: (row) => row.actor ? `${row.actor.firstName ?? ''} ${row.actor.lastName ?? ''}` : 'Sistema' },
    { key: 'ip', header: 'Dirección IP', render: (row) => row.ip ?? '—' },
  ];

  const userFields: FormField[] = userModal ? [
    field('email', 'Correo electrónico', { disabled: true }),
    field('firstName', 'Nombre', { required: true }),
    field('lastName', 'Apellido', { required: true }),
    field('status', 'Estado', { type: 'select', options: USER_STATUSES }),
    field('password', 'Nueva contraseña (opcional)', { type: 'password', helper: 'Mínimo 8 caracteres' }),
  ] : [
    field('email', 'Correo electrónico', { type: 'email', required: true }),
    field('password', 'Contraseña', { type: 'password', required: true, helper: 'Mínimo 8 caracteres' }),
    field('firstName', 'Nombre', { required: true }),
    field('lastName', 'Apellido', { required: true }),
    field('globalRole', 'Rol global', { type: 'select', options: GLOBAL_ROLES }),
    field('roleKeys', 'Claves de roles (separadas por coma)', { full: true, placeholder: 'OPERATOR,SUPERVISOR' }),
  ];

  const tabs: Array<{ id: Tab; label: string; icon: typeof Users }> = [
    { id: 'company', label: 'Empresa', icon: Shield },
    { id: 'modules', label: 'Módulos', icon: RefreshCw },
    { id: 'users', label: 'Usuarios', icon: Users },
    { id: 'roles', label: 'Roles y permisos', icon: Shield },
    { id: 'audit', label: 'Auditoría', icon: RefreshCw },
    { id: 'password', label: 'Contraseña', icon: KeyRound },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Configuración" description="Parámetros de la empresa, usuarios, módulos y seguridad." />
      {!isSuperAdmin && user?.globalRole !== 'ADMIN' && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Algunas opciones pueden estar restringidas según sus permisos.
        </p>
      )}

      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {tabs.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-semibold ${tab === item.id ? 'border-amber-500 text-amber-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
              <Icon className="h-4 w-4" /> {item.label}
            </button>
          );
        })}
      </div>

      {tab === 'company' && (
        <Card className="max-w-3xl">
          <CardHeader><CardTitle>Datos de la empresa</CardTitle><CardDescription>Información legal y zona horaria.</CardDescription></CardHeader>
          <CardContent>
            {tenantError && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{tenantError}</p>}
            {tenantLoading ? <p className="text-sm text-slate-400">Cargando…</p> : tenant ? (
              <form onSubmit={saveTenant} className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5"><Label htmlFor="name">Nombre</Label><Input id="name" value={tenant.name} onChange={(event) => setTenant({ ...tenant, name: event.target.value })} required /></div>
                <div className="space-y-1.5"><Label htmlFor="legalName">Razón social</Label><Input id="legalName" value={tenant.legalName ?? ''} onChange={(event) => setTenant({ ...tenant, legalName: event.target.value })} /></div>
                <div className="space-y-1.5"><Label htmlFor="taxId">RUT / NIF</Label><Input id="taxId" value={tenant.taxId ?? ''} onChange={(event) => setTenant({ ...tenant, taxId: event.target.value })} /></div>
                <div className="space-y-1.5"><Label htmlFor="timezone">Zona horaria</Label><Input id="timezone" value={tenant.timezone ?? 'UTC'} onChange={(event) => setTenant({ ...tenant, timezone: event.target.value })} /></div>
                <div className="space-y-1.5"><Label htmlFor="status">Estado</Label><Select id="status" value={tenant.status} onChange={(event) => setTenant({ ...tenant, status: event.target.value as Tenant['status'] })} options={TENANT_STATUSES} /></div>
                <div className="space-y-1.5"><Label>Slug</Label><Input value={tenant.slug} disabled /></div>
                <div className="sm:col-span-2 flex justify-end pt-2"><Button type="submit">Guardar cambios</Button></div>
              </form>
            ) : <p className="text-sm text-slate-400">No hay empresa asociada al usuario.</p>}
          </CardContent>
        </Card>
      )}

      {tab === 'modules' && (
        <Card>
          <CardHeader><CardTitle>Módulos activos</CardTitle><CardDescription>Active o desactive funcionalidades para esta empresa.</CardDescription></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {moduleLoading && <p className="text-sm text-slate-400">Cargando…</p>}
            {!moduleLoading && MODULES.map((key) => {
              const module = modules.find((m) => m.key === key);
              const enabled = module?.enabled ?? false;
              return (
                <label key={key} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-4">
                  <div><p className="text-sm font-semibold text-slate-800">{label(key)}</p><p className="text-xs text-slate-400">{enabled ? 'Habilitado' : 'Deshabilitado'}</p></div>
                  <input type="checkbox" checked={enabled} onChange={(event) => void toggleModule(key, event.target.checked)} className="h-5 w-5 accent-amber-500" />
                </label>
              );
            })}
          </CardContent>
        </Card>
      )}

      {tab === 'users' && (
        <ResourceTable
          data={users.data.filter((row) => !search || `${row.email} ${row.firstName} ${row.lastName}`.toLowerCase().includes(search.toLowerCase()))}
          columns={userColumns}
          loading={users.loading}
          error={users.error}
          onRetry={users.reload}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Buscar usuarios…"
          getRowKey={(row) => row.id}
          actions={<Button size="sm" onClick={() => setUserModal(null)}><Plus className="h-4 w-4" /> Nuevo usuario</Button>}
          emptyTitle="No hay usuarios"
          emptyDescription="Agregue usuarios a la empresa."
        />
      )}

      {tab === 'roles' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Roles</CardTitle><CardDescription>Roles disponibles en la empresa.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {roles.loading && <p className="text-sm text-slate-400">Cargando…</p>}
              {roles.error && <p className="text-sm text-red-600">{roles.error}</p>}
              {!roles.loading && roles.data.length === 0 && <p className="text-sm text-slate-400">No hay roles configurados.</p>}
              {roles.data.map((role) => (
                <div key={role.id} className="rounded-lg border border-slate-100 p-3">
                  <div className="flex items-center justify-between"><p className="font-semibold text-slate-800">{role.name}</p>{role.isSystem && <Badge variant="outline">Sistema</Badge>}</div>
                  <p className="font-mono text-xs text-amber-700">{role.key}</p>
                  <p className="mt-1 text-xs text-slate-500">{role.description ?? 'Sin descripción'}</p>
                  <div className="mt-2 flex flex-wrap gap-1">{role.permissions?.slice(0, 12).map((permission) => <Badge key={permission.key} variant="outline" className="text-[10px]">{permission.key}</Badge>)}</div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Permisos del sistema</CardTitle><CardDescription>Catálogo de permisos disponibles.</CardDescription></CardHeader>
            <CardContent className="max-h-96 space-y-1 overflow-y-auto">
              {permissionList.length === 0 && !permissionError && <p className="text-sm text-slate-400">Cargando…</p>}
              {permissionError && <p className="text-sm text-red-600">{permissionError}</p>}
              {permissionList.map((permission) => (
                <div key={permission.key} className="flex items-center justify-between border-b border-slate-50 py-2 text-xs">
                  <span className="font-mono text-slate-700">{permission.key}</span>
                  <span className="text-slate-400">{label(permission.module)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'audit' && (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
            <div><CardTitle>Auditoría</CardTitle><CardDescription>Registro de acciones realizadas en la plataforma.</CardDescription></div>
            <div className="flex gap-2">
              <Input type="date" aria-label="Desde" value={auditFrom} onChange={(event) => setAuditFrom(event.target.value)} className="w-40" />
              <Input type="date" aria-label="Hasta" value={auditTo} onChange={(event) => setAuditTo(event.target.value)} className="w-40" />
            </div>
          </CardHeader>
          <CardContent>
            <ResourceTable data={audits.data} columns={auditColumns} loading={audits.loading} error={audits.error} onRetry={audits.reload} getRowKey={(row) => row.id} searchPlaceholder="Filtrar…" emptyTitle="Sin eventos" emptyDescription="No hay eventos de auditoría en el período." />
          </CardContent>
        </Card>
      )}

      {tab === 'password' && (
        <Card className="max-w-lg">
          <CardHeader><CardTitle>Cambiar contraseña</CardTitle><CardDescription>Use una contraseña de al menos 8 caracteres.</CardDescription></CardHeader>
          <CardContent>
            <form onSubmit={changePassword} className="space-y-4">
              <div className="space-y-1.5"><Label htmlFor="currentPassword">Contraseña actual</Label><Input id="currentPassword" type="password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })} required /></div>
              <div className="space-y-1.5"><Label htmlFor="newPassword">Nueva contraseña</Label><Input id="newPassword" type="password" minLength={8} value={passwordForm.newPassword} onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })} required /></div>
              <div className="space-y-1.5"><Label htmlFor="confirmPassword">Confirmar contraseña</Label><Input id="confirmPassword" type="password" minLength={8} value={passwordForm.confirm} onChange={(event) => setPasswordForm({ ...passwordForm, confirm: event.target.value })} required /></div>
              {passwordError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{passwordError}</p>}
              <Button type="submit" disabled={passwordSaving}>{passwordSaving ? 'Guardando…' : 'Actualizar contraseña'}</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <FormModal
        open={userModal !== undefined}
        onOpenChange={(open) => !open && setUserModal(undefined)}
        title={userModal ? 'Editar usuario' : 'Nuevo usuario'}
        initialValues={userModal ?? { globalRole: 'USER', status: 'ACTIVE' }}
        fields={userFields}
        onSubmit={saveUser}
        submitLabel="Guardar"
      />
      <ConfirmDialog open={!!deleteUser} onOpenChange={(open) => !open && setDeleteUser(null)} title="Eliminar usuario" description={`¿Eliminar el usuario ${deleteUser?.email ?? ''}?`} onConfirm={removeUser} />
    </div>
  );
}
