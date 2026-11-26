'use client';

import { useEffect, useState } from 'react';
import { Layers3, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { PageHeader } from '@/components/shared/page-header';
import { ResourceTable, StatusCell, type Column } from '@/components/shared/resource-table';
import { FormModal, field, type FormValues } from '@/components/shared/form-modal';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { useApiList } from '@/hooks/use-api';
import { api, type Area, type Mine, type Project } from '@/lib/api';
import { label } from '@/lib/format';

const MODES = [
  { value: 'OPEN_PIT', label: 'Cielo abierto' },
  { value: 'UNDERGROUND', label: 'Subterráneo' },
];
const MINE_STATUSES = [
  { value: 'PLANNED', label: 'Planificado' },
  { value: 'ACTIVE', label: 'Activo' },
  { value: 'SUSPENDED', label: 'Suspendido' },
  { value: 'CLOSED', label: 'Cerrado' },
];
const AREA_TYPES = [
  'BENCH', 'PHASE', 'EXTRACTION_FRONT', 'HAUL_ROAD', 'LEVEL', 'DRIFT', 'RAMP', 'ADVANCE_FRONT', 'OTHER',
].map((value) => ({ value, label: label(value) }));

export default function MinesPage() {
  const { success, error: toastError } = useToast();
  const mines = useApiList<Mine>('/mines');
  const projects = useApiList<Project>('/projects');
  const [search, setSearch] = useState('');
  const [projectId, setProjectId] = useState('');
  const [mode, setMode] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Mine | null>(null);
  const [deleting, setDeleting] = useState<Mine | null>(null);
  const [sectorMine, setSectorMine] = useState<Mine | null>(null);
  const [sectorFormOpen, setSectorFormOpen] = useState(false);
  const areas = useApiList<Area>(sectorMine ? '/areas' : null, { mineId: sectorMine?.id });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    if (q) setSearch(q);
    const sector = params.get('sector');
    if (sector && mines.data.length) {
      const found = mines.data.find((mine) => mine.id === sector);
      if (found) setSectorMine(found);
    }
  }, [mines.data]);

  const filtered = mines.data.filter((mine) => {
    const term = search.trim().toLowerCase();
    return (
      (!term || `${mine.code} ${mine.name} ${mine.description ?? ''}`.toLowerCase().includes(term)) &&
      (!projectId || mine.projectId === projectId) &&
      (!mode || mine.mode === mode)
    );
  });

  async function save(values: FormValues) {
    const payload = {
      projectId: String(values.projectId),
      code: String(values.code).trim(),
      name: String(values.name).trim(),
      mode: String(values.mode),
      status: String(values.status),
      description: values.description ? String(values.description) : null,
      latitude: values.latitude === '' ? null : Number(values.latitude),
      longitude: values.longitude === '' ? null : Number(values.longitude),
    };
    if (editing) await api.patch(`/mines/${editing.id}`, payload);
    else await api.post('/mines', payload);
    success(editing ? 'Yacimiento actualizado' : 'Yacimiento creado', payload.name);
    setFormOpen(false);
    mines.reload();
  }

  async function remove() {
    if (!deleting) return;
    try {
      await api.delete(`/mines/${deleting.id}`);
      success('Yacimiento eliminado', deleting.name);
      mines.reload();
    } catch (err) {
      toastError('No se pudo eliminar el yacimiento', err instanceof Error ? err.message : undefined);
      throw err;
    }
  }

  async function saveArea(values: FormValues) {
    if (!sectorMine) return;
    await api.post('/areas', {
      mineId: sectorMine.id,
      parentId: values.parentId ? String(values.parentId) : null,
      code: String(values.code).trim(),
      name: String(values.name).trim(),
      type: String(values.type),
      description: values.description ? String(values.description) : null,
    });
    success('Sector creado', String(values.name));
    setSectorFormOpen(false);
    areas.reload();
  }

  const columns: Array<Column<Mine>> = [
    { key: 'code', header: 'Código', render: (row) => <span className="font-mono text-xs font-semibold text-amber-700">{row.code}</span> },
    { key: 'name', header: 'Yacimiento', render: (row) => <div><p className="font-semibold text-slate-800">{row.name}</p><p className="text-xs text-slate-400">{row.project?.name ?? projects.data.find((p) => p.id === row.projectId)?.name ?? '—'}</p></div> },
    { key: 'mode', header: 'Modalidad', render: (row) => <Badge variant={row.mode === 'OPEN_PIT' ? 'warning' : 'purple'}>{label(row.mode)}</Badge> },
    { key: 'status', header: 'Estado', render: (row) => <StatusCell value={row.status} /> },
    {
      key: 'coords',
      header: 'Ubicación',
      render: (row) => row.latitude && row.longitude ? (
        <span className="flex items-center gap-1 text-xs text-slate-500"><MapPin className="h-3.5 w-3.5" />{Number(row.latitude).toFixed(4)}, {Number(row.longitude).toFixed(4)}</span>
      ) : <span className="text-slate-400">—</span>,
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (row) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => setSectorMine(row)} className="text-emerald-700"><Layers3 className="h-4 w-4" /> Sectores</Button>
          <Button variant="ghost" size="icon" onClick={() => { setEditing(row); setFormOpen(true); }} aria-label="Editar"><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="text-red-500" onClick={() => setDeleting(row)} aria-label="Eliminar"><Trash2 className="h-4 w-4" /></Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Yacimientos"
        description="Administre los yacimientos, su modalidad de explotación y sectores."
        actions={<Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="h-4 w-4" /> Nuevo yacimiento</Button>}
      />

      <ResourceTable
        data={filtered}
        columns={columns}
        loading={mines.loading}
        error={mines.error}
        onRetry={mines.reload}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar yacimientos…"
        filters={[
          { key: 'project', label: 'Proyecto', value: projectId, options: projects.data.map((p) => ({ value: p.id, label: p.name })), onChange: setProjectId },
          { key: 'mode', label: 'Modalidad', value: mode, options: MODES, onChange: setMode },
        ]}
        getRowKey={(row) => row.id}
        emptyTitle="No hay yacimientos"
        emptyDescription="Cree un yacimiento asociado a un proyecto."
      />

      <FormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editing ? 'Editar yacimiento' : 'Nuevo yacimiento'}
        initialValues={editing ?? { mode: 'OPEN_PIT', status: 'PLANNED', projectId: projectId }}
        onSubmit={save}
        submitLabel={editing ? 'Guardar cambios' : 'Crear yacimiento'}
        fields={[
          field('projectId', 'Proyecto', { type: 'select', required: true, options: projects.data.map((p) => ({ value: p.id, label: p.name })) }),
          field('code', 'Código', { required: true, placeholder: 'YAC-001' }),
          field('name', 'Nombre', { required: true }),
          field('mode', 'Modalidad', { type: 'select', required: true, options: MODES }),
          field('status', 'Estado', { type: 'select', required: true, options: MINE_STATUSES }),
          field('latitude', 'Latitud', { type: 'number', step: '0.0000001', placeholder: '-33.4500000' }),
          field('longitude', 'Longitud', { type: 'number', step: '0.0000001', placeholder: '-70.6000000' }),
          field('description', 'Descripción', { type: 'textarea', full: true }),
        ]}
      />

      <ConfirmDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)} title="Eliminar yacimiento" description={`¿Eliminar “${deleting?.name ?? ''}” y sus sectores asociados?`} onConfirm={remove} />

      <Dialog open={!!sectorMine} onOpenChange={(open) => !open && setSectorMine(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Sectores de {sectorMine?.name}</DialogTitle>
            <DialogDescription>Estructura jerárquica de áreas del yacimiento.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setSectorFormOpen(true)}><Plus className="h-4 w-4" /> Nuevo sector</Button>
          </div>
          {areas.loading && <p className="py-6 text-center text-sm text-slate-400">Cargando sectores…</p>}
          {areas.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{areas.error}</p>}
          {!areas.loading && !areas.error && areas.data.length === 0 && <p className="py-6 text-center text-sm text-slate-400">No hay sectores registrados.</p>}
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {areas.data.map((area) => (
              <div key={area.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-amber-50 p-2 text-amber-700"><Layers3 className="h-4 w-4" /></div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{area.name} <span className="font-mono text-xs text-slate-400">({area.code})</span></p>
                    <p className="text-xs text-slate-500">{label(area.type)} {area.parentId ? '· sector hijo' : ''}</p>
                  </div>
                </div>
                <StatusCell value={area.status} />
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <FormModal
        open={sectorFormOpen}
        onOpenChange={setSectorFormOpen}
        title="Nuevo sector"
        initialValues={{ type: 'BENCH', mineId: sectorMine?.id }}
        onSubmit={saveArea}
        submitLabel="Crear sector"
        fields={[
          field('code', 'Código', { required: true, placeholder: 'BANCO-01' }),
          field('name', 'Nombre', { required: true }),
          field('type', 'Tipo', { type: 'select', required: true, options: AREA_TYPES }),
          field('parentId', 'Sector padre', { type: 'select', options: areas.data.map((a) => ({ value: a.id, label: a.name })) }),
          field('description', 'Descripción', { type: 'textarea', full: true }),
        ]}
      />
    </div>
  );
}
