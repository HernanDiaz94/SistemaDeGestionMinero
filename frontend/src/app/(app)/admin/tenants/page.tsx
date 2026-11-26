'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, CreditCard, Layers3, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { PageHeader } from '@/components/shared/page-header';
import { ResourceTable, StatusCell, type Column } from '@/components/shared/resource-table';
import { FormModal, field, type FormValues } from '@/components/shared/form-modal';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { useApiList } from '@/hooks/use-api';
import { useAuth } from '@/lib/auth';
import { api, type Subscription, type Tenant, type TenantModule } from '@/lib/api';
import { listOf } from '@/lib/utils';
import { formatDate, label } from '@/lib/format';

const TENANT_STATUSES = ['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED'].map((value) => ({ value, label: label(value) }));
const MODULE_KEYS = ['DASHBOARD', 'PROJECTS', 'MINES', 'OPERATIONS', 'PRODUCTION', 'EQUIPMENT', 'PERSONNEL', 'REPORTS', 'SETTINGS'];

export default function AdminTenantsPage() {
  const { isSuperAdmin, loading } = useAuth();
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const tenants = useApiList<Tenant>(isSuperAdmin ? '/tenants' : null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [deleting, setDeleting] = useState<Tenant | null>(null);
  const [viewing, setViewing] = useState<Tenant | null>(null);
  const [modules, setModules] = useState<TenantModule[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [subscriptionForm, setSubscriptionForm] = useState(false);
  const [subscriptionValues, setSubscriptionValues] = useState({ plan: 'Básico', status: 'TRIAL', maxUsers: '10', endDate: '' });

  useEffect(() => {
    if (!loading && !isSuperAdmin) router.replace('/dashboard');
  }, [loading, isSuperAdmin, router]);

  async function loadDetail(tenant: Tenant) {
    setViewing(tenant);
    setDetailLoading(true);
    try {
      const [moduleResponse, subscriptionResponse] = await Promise.all([
        api.get<unknown>(`/tenants/${tenant.id}/modules`),
        api.get<unknown>(`/tenants/${tenant.id}`),
      ]);
      setModules(listOf<TenantModule>(moduleResponse));
      const full = subscriptionResponse as Tenant;
      setSubscriptions(Array.isArray(full.subscriptions) ? full.subscriptions : listOf<Subscription>(full));
    } catch (err) {
      toastError('No se pudo cargar el detalle de la empresa', err instanceof Error ? err.message : undefined);
      setModules([]);
      setSubscriptions([]);
    } finally {
      setDetailLoading(false);
    }
  }

  async function save(values: FormValues) {
    const payload: Record<string, unknown> = {
      name: String(values.name).trim(),
      legalName: values.legalName ? String(values.legalName) : null,
      taxId: values.taxId ? String(values.taxId) : null,
      timezone: String(values.timezone || 'UTC'),
      status: String(values.status),
    };
    if (values.slug) payload.slug = String(values.slug).trim().toLowerCase();
    if (!editing) {
      payload.adminEmail = values.adminEmail ? String(values.adminEmail) : undefined;
      payload.adminPassword = values.adminPassword ? String(values.adminPassword) : undefined;
    }
    if (editing) await api.patch(`/tenants/${editing.id}`, payload);
    else await api.post('/tenants', payload);
    success(editing ? 'Empresa actualizada' : 'Empresa creada', String(values.name));
    setFormOpen(false);
    tenants.reload();
  }

  async function remove() {
    if (!deleting) return;
    try {
      await api.delete(`/tenants/${deleting.id}`);
      success('Empresa eliminada', deleting.name);
      tenants.reload();
    } catch (err) {
      toastError('No se pudo eliminar la empresa', err instanceof Error ? err.message : undefined);
      throw err;
    }
  }

  async function createSubscription(event: FormEvent) {
    event.preventDefault();
    if (!viewing) return;
    try {
      await api.post(`/tenants/${viewing.id}/subscriptions`, {
        plan: subscriptionValues.plan,
        status: subscriptionValues.status,
        maxUsers: Number(subscriptionValues.maxUsers),
        ...(subscriptionValues.endDate ? { endDate: subscriptionValues.endDate } : {}),
      });
      success('Suscripción creada', subscriptionValues.plan);
      setSubscriptionForm(false);
      await loadDetail(viewing);
    } catch (err) {
      toastError('No se pudo crear la suscripción', err instanceof Error ? err.message : undefined);
    }
  }

  const filtered = tenants.data.filter((tenant) => {
    const term = search.trim().toLowerCase();
    return (!term || `${tenant.name} ${tenant.slug} ${tenant.taxId ?? ''}`.toLowerCase().includes(term)) && (!status || tenant.status === status);
  });

  const columns: Array<Column<Tenant>> = [
    { key: 'name', header: 'Empresa', render: (row) => <div><p className="font-semibold text-slate-800">{row.name}</p><p className="text-xs text-slate-400">{row.legalName ?? '—'}</p></div> },
    { key: 'slug', header: 'Slug', render: (row) => <span className="font-mono text-xs text-amber-700">{row.slug}</span> },
    { key: 'taxId', header: 'Identificación', render: (row) => row.taxId ?? '—' },
    { key: 'status', header: 'Estado', render: (row) => <StatusCell value={row.status} /> },
    { key: 'created', header: 'Creación', render: (row) => formatDate(row.createdAt) },
    {
      key: 'actions',
      header: 'Acciones',
      render: (row) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" className="text-emerald-700" onClick={() => void loadDetail(row)}><Layers3 className="h-4 w-4" /> Ver</Button>
          <Button variant="ghost" size="icon" onClick={() => { setEditing(row); setFormOpen(true); }} aria-label="Editar"><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="text-red-500" onClick={() => setDeleting(row)} aria-label="Eliminar"><Trash2 className="h-4 w-4" /></Button>
        </div>
      ),
    },
  ];

  if (loading || !isSuperAdmin) return <div className="py-10 text-center text-sm text-slate-500">Verificando permisos…</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Panel multiempresa"
        description="Administración global de organizaciones, módulos y suscripciones."
        actions={<Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="h-4 w-4" /> Nueva empresa</Button>}
      />

      <ResourceTable
        data={filtered}
        columns={columns}
        loading={tenants.loading}
        error={tenants.error}
        onRetry={tenants.reload}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar empresas…"
        filters={[{ key: 'status', label: 'Estado', value: status, options: TENANT_STATUSES, onChange: setStatus }]}
        getRowKey={(row) => row.id}
        emptyTitle="No hay empresas"
        emptyDescription="Cree la primera organización del sistema."
      />

      <FormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editing ? 'Editar empresa' : 'Nueva empresa'}
        initialValues={editing ?? { status: 'TRIAL', timezone: 'UTC' }}
        onSubmit={save}
        submitLabel={editing ? 'Guardar cambios' : 'Crear empresa'}
        fields={[
          field('name', 'Nombre', { required: true }),
          field('slug', 'Slug', { required: !editing, placeholder: 'minera-aurora' }),
          field('legalName', 'Razón social'),
          field('taxId', 'RUT / NIF'),
          field('timezone', 'Zona horaria'),
          field('status', 'Estado', { type: 'select', required: true, options: TENANT_STATUSES }),
          ...(!editing ? [
            field('adminEmail', 'Correo del administrador', { type: 'email', helper: 'Se creará este usuario como administrador de la empresa.' }),
            field('adminPassword', 'Contraseña del administrador', { type: 'password', helper: 'Mínimo 8 caracteres.' }),
          ] : []),
        ]}
      />
      <ConfirmDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)} title="Eliminar empresa" description={`¿Eliminar la empresa “${deleting?.name ?? ''}” y todos sus datos?`} onConfirm={remove} />

      <Dialog open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{viewing?.name}</DialogTitle>
            <DialogDescription>Slug: {viewing?.slug} · Estado: {viewing ? label(viewing.status) : ''}</DialogDescription>
          </DialogHeader>
          {detailLoading && <p className="py-6 text-center text-sm text-slate-400">Cargando detalle…</p>}
          {!detailLoading && (
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="text-sm">Módulos</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {MODULE_KEYS.map((key) => {
                    const enabled = modules.find((module) => module.key === key)?.enabled ?? false;
                    return (
                      <div key={key} className="flex items-center justify-between border-b border-slate-50 py-1.5 text-xs">
                        <span>{label(key)}</span>
                        <Badge variant={enabled ? 'success' : 'neutral'}>{enabled ? 'Activo' : 'Inactivo'}</Badge>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-sm">Suscripciones</CardTitle>
                  <Button size="sm" variant="outline" onClick={() => setSubscriptionForm(true)}><CreditCard className="h-4 w-4" /> Nueva</Button>
                </CardHeader>
                <CardContent className="space-y-2">
                  {subscriptions.length === 0 && <p className="text-sm text-slate-400">Sin suscripciones registradas.</p>}
                  {subscriptions.map((subscription, index) => (
                    <div key={subscription.id ?? index} className="rounded-lg border border-slate-100 p-3 text-sm">
                      <div className="flex items-center justify-between"><span className="font-semibold">{subscription.plan}</span><StatusCell value={subscription.status} /></div>
                      <p className="mt-1 text-xs text-slate-500">Máx. {subscription.maxUsers ?? '—'} usuarios · Fin: {formatDate(subscription.endDate)}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={subscriptionForm} onOpenChange={setSubscriptionForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nueva suscripción</DialogTitle><DialogDescription>Asocie un plan a {viewing?.name}.</DialogDescription></DialogHeader>
          <form onSubmit={createSubscription} className="space-y-4">
            <div className="space-y-1.5"><Label htmlFor="plan">Plan</Label><Input id="plan" value={subscriptionValues.plan} onChange={(event) => setSubscriptionValues({ ...subscriptionValues, plan: event.target.value })} required /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label htmlFor="subStatus">Estado</Label><select id="subStatus" className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm" value={subscriptionValues.status} onChange={(event) => setSubscriptionValues({ ...subscriptionValues, status: event.target.value })}><option value="TRIAL">Prueba</option><option value="ACTIVE">Activo</option><option value="PAST_DUE">Vencido</option><option value="CANCELLED">Cancelado</option></select></div>
              <div className="space-y-1.5"><Label htmlFor="maxUsers">Máx. usuarios</Label><Input id="maxUsers" type="number" min={1} value={subscriptionValues.maxUsers} onChange={(event) => setSubscriptionValues({ ...subscriptionValues, maxUsers: event.target.value })} /></div>
            </div>
            <div className="space-y-1.5"><Label htmlFor="endDate">Fecha de término</Label><Input id="endDate" type="date" value={subscriptionValues.endDate} onChange={(event) => setSubscriptionValues({ ...subscriptionValues, endDate: event.target.value })} /></div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setSubscriptionForm(false)}>Cancelar</Button><Button type="submit">Crear suscripción</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
