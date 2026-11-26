'use client';

import { useEffect, useState } from 'react';
import { Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { PageHeader } from '@/components/shared/page-header';
import { ResourceTable, StatusCell, TextCell, type Column } from '@/components/shared/resource-table';
import { FormModal, field, type FormValues } from '@/components/shared/form-modal';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { useApiList } from '@/hooks/use-api';
import { api, type Mine, type Project } from '@/lib/api';
import { formatDate, label } from '@/lib/format';
import { toInputDate } from '@/lib/utils';

const PROJECT_STATUSES = [
  { value: 'PLANNED', label: 'Planificado' },
  { value: 'ACTIVE', label: 'Activo' },
  { value: 'SUSPENDED', label: 'Suspendido' },
  { value: 'COMPLETED', label: 'Completado' },
];

export default function ProjectsPage() {
  const { success, error: toastError } = useToast();
  const projects = useApiList<Project>('/projects');
  const mines = useApiList<Mine>('/mines');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState<Project | null>(null);
  const [viewing, setViewing] = useState<Project | null>(null);
  const [stats, setStats] = useState<unknown>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('q');
    if (q) setSearch(q);
  }, []);

  const filtered = projects.data.filter((project) => {
    const term = search.trim().toLowerCase();
    const matchesSearch = !term || `${project.code} ${project.name} ${project.description ?? ''}`.toLowerCase().includes(term);
    return matchesSearch && (!status || project.status === status);
  });

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(project: Project) {
    setEditing(project);
    setFormOpen(true);
  }

  async function save(values: FormValues) {
    const payload = {
      code: String(values.code).trim(),
      name: String(values.name).trim(),
      description: values.description ? String(values.description) : null,
      status: String(values.status),
      startDate: values.startDate ? String(values.startDate) : null,
      endDate: values.endDate ? String(values.endDate) : null,
    };
    if (editing) await api.patch(`/projects/${editing.id}`, payload);
    else await api.post('/projects', payload);
    success(editing ? 'Proyecto actualizado' : 'Proyecto creado', payload.name);
    setFormOpen(false);
    projects.reload();
  }

  async function remove() {
    if (!deleting) return;
    try {
      await api.delete(`/projects/${deleting.id}`);
      success('Proyecto eliminado', deleting.name);
      projects.reload();
    } catch (err) {
      toastError('No se pudo eliminar el proyecto', err instanceof Error ? err.message : undefined);
      throw err;
    }
  }

  async function openView(project: Project) {
    setViewing(project);
    setStats(null);
    setStatsLoading(true);
    try {
      const response = await api.get<unknown>(`/projects/${project.id}/stats`);
      setStats(response);
    } catch (err) {
      toastError('No se pudieron cargar las estadísticas', err instanceof Error ? err.message : undefined);
    } finally {
      setStatsLoading(false);
    }
  }

  const columns: Array<Column<Project>> = [
    { key: 'code', header: 'Código', render: (row) => <span className="font-mono text-xs font-semibold text-amber-700">{row.code}</span> },
    { key: 'name', header: 'Proyecto', render: (row) => <div><p className="font-semibold text-slate-800">{row.name}</p><p className="max-w-xs truncate text-xs text-slate-400">{row.description ?? 'Sin descripción'}</p></div> },
    { key: 'status', header: 'Estado', render: (row) => <StatusCell value={row.status} /> },
    { key: 'dates', header: 'Período', render: (row) => `${formatDate(row.startDate)} – ${formatDate(row.endDate)}` },
    { key: 'mines', header: 'Minas', render: (row) => <Badge variant="outline">{mines.data.filter((mine) => mine.projectId === row.id).length}</Badge> },
    {
      key: 'actions',
      header: 'Acciones',
      render: (row) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" onClick={(event) => { event.stopPropagation(); void openView(row); }} aria-label="Ver minas"><Eye className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={(event) => { event.stopPropagation(); openEdit(row); }} aria-label="Editar"><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={(event) => { event.stopPropagation(); setDeleting(row); }} aria-label="Eliminar" className="text-red-500"><Trash2 className="h-4 w-4" /></Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Proyectos"
        description="Gestión de los proyectos mineros y su estado de ejecución."
        actions={<Button onClick={openCreate}><Plus className="h-4 w-4" /> Nuevo proyecto</Button>}
      />

      <ResourceTable
        data={filtered}
        columns={columns}
        loading={projects.loading}
        error={projects.error}
        onRetry={projects.reload}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por código o nombre…"
        filters={[{ key: 'status', label: 'Estado', value: status, options: PROJECT_STATUSES, onChange: setStatus }]}
        getRowKey={(row) => row.id}
        emptyTitle="No hay proyectos"
        emptyDescription="Cree el primer proyecto para comenzar a gestionar la operación."
      />

      <FormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editing ? 'Editar proyecto' : 'Nuevo proyecto'}
        description="Los campos marcados con * son obligatorios."
        initialValues={editing ?? { status: 'PLANNED' }}
        onSubmit={save}
        submitLabel={editing ? 'Guardar cambios' : 'Crear proyecto'}
        fields={[
          field('code', 'Código', { required: true, placeholder: 'PRY-001' }),
          field('name', 'Nombre', { required: true, placeholder: 'Proyecto Aurora' }),
          field('description', 'Descripción', { type: 'textarea', full: true, placeholder: 'Objetivo y alcance del proyecto' }),
          field('status', 'Estado', { type: 'select', required: true, options: PROJECT_STATUSES }),
          field('startDate', 'Fecha de inicio', { type: 'date' }),
          field('endDate', 'Fecha de término', { type: 'date' }),
        ]}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Eliminar proyecto"
        description={`¿Eliminar el proyecto “${deleting?.name ?? ''}”? Esta acción no se puede deshacer.`}
        onConfirm={remove}
      />

      <Dialog open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{viewing?.name}</DialogTitle>
            <DialogDescription>
              Código {viewing?.code} · Estado {viewing ? label(viewing.status) : ''} · {formatDate(viewing?.startDate)} a {formatDate(viewing?.endDate)}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-sm">Estadísticas</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {statsLoading ? <p className="text-slate-400">Cargando…</p> : stats === null ? (
                  <p className="text-slate-400">Sin estadísticas disponibles.</p>
                ) : (
                  Object.entries(stats as Record<string, unknown>).slice(0, 12).map(([key, value]) => (
                    <div key={key} className="flex justify-between gap-3 border-b border-slate-50 py-1">
                      <span className="text-slate-500">{label(key)}</span>
                      <TextCell value={typeof value === 'object' ? JSON.stringify(value) : value} />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Yacimientos del proyecto</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {mines.data.filter((mine) => mine.projectId === viewing?.id).length === 0 && (
                  <p className="text-sm text-slate-400">Este proyecto aún no tiene yacimientos.</p>
                )}
                {mines.data.filter((mine) => mine.projectId === viewing?.id).map((mine) => (
                  <div key={mine.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
                    <div><p className="text-sm font-semibold">{mine.name}</p><p className="text-xs text-slate-400">{mine.code}</p></div>
                    <StatusCell value={mine.status} />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
