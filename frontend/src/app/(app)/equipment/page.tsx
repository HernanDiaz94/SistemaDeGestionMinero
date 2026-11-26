'use client';

import { useEffect, useState } from 'react';
import { Fuel, Gauge, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { PageHeader } from '@/components/shared/page-header';
import { ResourceTable, StatusCell, type Column } from '@/components/shared/resource-table';
import { FormModal, field, type FormValues } from '@/components/shared/form-modal';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { useApiList } from '@/hooks/use-api';
import { api, type Employee, type Equipment, type EquipmentCategory, type Project } from '@/lib/api';
import { listOf } from '@/lib/utils';
import { formatDate, formatNumber, label } from '@/lib/format';
import { todayInput } from '@/lib/utils';

type ModalKind = 'equipment' | 'category' | 'reading' | 'fuel';
interface ModalState { kind: ModalKind; item: Equipment | EquipmentCategory | null }

const STATUS = ['OPERATIONAL', 'MAINTENANCE', 'OUT_OF_SERVICE', 'INACTIVE'].map((value) => ({ value, label: label(value) }));

export default function EquipmentPage() {
  const { success, error: toastError } = useToast();
  const [tab, setTab] = useState<'equipment' | 'categories'>('equipment');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [projectId, setProjectId] = useState('');
  const [modal, setModal] = useState<ModalState | null>(null);
  const [deleting, setDeleting] = useState<{ kind: 'equipment' | 'category'; id: string; name: string } | null>(null);
  const [history, setHistory] = useState<Equipment | null>(null);
  const [readings, setReadings] = useState<unknown[]>([]);
  const [fuels, setFuels] = useState<unknown[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [tick, setTick] = useState(0);

  const equipment = useApiList<Equipment>('/equipment');
  const categories = useApiList<EquipmentCategory>('/equipment/categories');
  const projects = useApiList<Project>('/projects');
  const employees = useApiList<Employee>('/employees');

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('q');
    if (q) setSearch(q);
  }, []);

  useEffect(() => {
    if (!history) return;
    const controller = new AbortController();
    setHistoryLoading(true);
    Promise.all([
      api.get<unknown>(`/equipment/${history.id}/readings`, undefined, controller.signal).catch(() => []),
      api.get<unknown>(`/equipment/${history.id}/fuel`, undefined, controller.signal).catch(() => []),
    ]).then(([r, f]) => {
      setReadings(listOf(r));
      setFuels(listOf(f));
      setHistoryLoading(false);
    });
    return () => controller.abort();
  }, [history, tick]);

  const filtered = equipment.data.filter((item) => {
    const term = search.trim().toLowerCase();
    return (!term || `${item.code} ${item.name} ${item.brand ?? ''} ${item.serialNumber ?? ''}`.toLowerCase().includes(term)) &&
      (!status || item.status === status) &&
      (!projectId || item.projectId === projectId);
  });

  async function save(values: FormValues) {
    if (!modal) return;
    let path: string;
    let payload: Record<string, unknown>;
    if (modal.kind === 'equipment') {
      const item = modal.item as Equipment | null;
      path = `/equipment${item ? `/${item.id}` : ''}`;
      payload = {
        code: String(values.code).trim(),
        name: String(values.name).trim(),
        categoryId: values.categoryId ? String(values.categoryId) : null,
        projectId: values.projectId ? String(values.projectId) : null,
        responsibleId: values.responsibleId ? String(values.responsibleId) : null,
        brand: values.brand ? String(values.brand) : null,
        model: values.model ? String(values.model) : null,
        serialNumber: values.serialNumber ? String(values.serialNumber) : null,
        status: String(values.status),
        operatingHours: Number(values.operatingHours ?? 0),
        purchaseDate: values.purchaseDate ? String(values.purchaseDate) : null,
        notes: values.notes ? String(values.notes) : null,
      };
    } else if (modal.kind === 'category') {
      const item = modal.item as EquipmentCategory | null;
      path = `/equipment/categories${item ? `/${item.id}` : ''}`;
      payload = { code: String(values.code).trim(), name: String(values.name).trim(), description: values.description ? String(values.description) : null };
    } else {
      const item = modal.item as Equipment;
      path = modal.kind === 'reading' ? `/equipment/${item.id}/readings` : `/equipment/${item.id}/fuel`;
      payload = modal.kind === 'reading'
        ? { readAt: values.readAt || todayInput(), hours: Number(values.hours), notes: values.notes ? String(values.notes) : undefined }
        : { date: values.date || todayInput(), liters: Number(values.liters), cost: values.cost === '' ? undefined : Number(values.cost), station: values.station ? String(values.station) : undefined, notes: values.notes ? String(values.notes) : undefined };
    }
    if (modal.kind === 'equipment' || modal.kind === 'category') {
      const isEdit = !!modal.item;
      if (isEdit) await api.patch(path, payload);
      else await api.post(path, payload);
      success(isEdit ? 'Registro actualizado' : 'Registro creado', String(values.name ?? ''));
      equipment.reload();
      categories.reload();
    } else {
      await api.post(path, payload);
      success(modal.kind === 'reading' ? 'Lectura registrada' : 'Combustible registrado');
      setTick((value) => value + 1);
      equipment.reload();
    }
    setModal(null);
  }

  async function remove() {
    if (!deleting) return;
    try {
      await api.delete(`/${deleting.kind === 'equipment' ? 'equipment' : 'equipment/categories'}/${deleting.id}`);
      success('Registro eliminado', deleting.name);
      equipment.reload();
      categories.reload();
    } catch (err) {
      toastError('No se pudo eliminar el registro', err instanceof Error ? err.message : undefined);
      throw err;
    }
  }

  const equipmentColumns: Array<Column<Equipment>> = [
    { key: 'code', header: 'Código', render: (row) => <span className="font-mono text-xs font-semibold text-amber-700">{row.code}</span> },
    { key: 'name', header: 'Equipo', render: (row) => <div><p className="font-semibold">{row.name}</p><p className="text-xs text-slate-400">{row.brand ?? ''} {row.model ?? ''} · {row.serialNumber ?? ''}</p></div> },
    { key: 'category', header: 'Categoría', render: (row) => row.category?.name ?? '—' },
    { key: 'project', header: 'Proyecto', render: (row) => row.project?.name ?? '—' },
    { key: 'hours', header: 'Horas', render: (row) => formatNumber(row.operatingHours ?? 0, 1) },
    { key: 'status', header: 'Estado', render: (row) => <StatusCell value={row.status} /> },
    {
      key: 'actions',
      header: 'Acciones',
      render: (row) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" title="Registrar lectura" onClick={() => setModal({ kind: 'reading', item: row })}><Gauge className="h-4 w-4 text-emerald-700" /></Button>
          <Button variant="ghost" size="icon" title="Registrar combustible" onClick={() => setModal({ kind: 'fuel', item: row })}><Fuel className="h-4 w-4 text-amber-600" /></Button>
          <Button variant="ghost" size="icon" title="Ver historial" onClick={() => setHistory(row)}><Plus className="h-4 w-4 text-sky-600" /></Button>
          <Button variant="ghost" size="icon" onClick={() => setModal({ kind: 'equipment', item: row })} aria-label="Editar"><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={() => setDeleting({ kind: 'equipment', id: row.id, name: row.name })} aria-label="Eliminar" className="text-red-500"><Trash2 className="h-4 w-4" /></Button>
        </div>
      ),
    },
  ];

  const categoryColumns: Array<Column<EquipmentCategory>> = [
    { key: 'code', header: 'Código', render: (row) => <span className="font-mono text-xs font-semibold text-amber-700">{row.code}</span> },
    { key: 'name', header: 'Categoría', render: (row) => <span className="font-semibold">{row.name}</span> },
    { key: 'description', header: 'Descripción', render: (row) => row.description ?? '—' },
    { key: 'actions', header: 'Acciones', render: (row) => <div className="flex justify-end gap-1">
      <Button variant="ghost" size="icon" onClick={() => setModal({ kind: 'category', item: row })} aria-label="Editar"><Pencil className="h-4 w-4" /></Button>
      <Button variant="ghost" size="icon" className="text-red-500" onClick={() => setDeleting({ kind: 'category', id: row.id, name: row.name })} aria-label="Eliminar"><Trash2 className="h-4 w-4" /></Button>
    </div> },
  ];

  function modalFields(): { fields: ReturnType<typeof field>[]; title: string } {
    if (!modal) return { fields: [], title: '' };
    if (modal.kind === 'equipment') return {
      title: modal.item ? 'Editar maquinaria' : 'Nueva maquinaria',
      fields: [
        field('code', 'Código', { required: true, placeholder: 'EQ-001' }),
        field('name', 'Nombre', { required: true }),
        field('categoryId', 'Categoría', { type: 'select', options: categories.data.map((c) => ({ value: c.id, label: c.name })) }),
        field('projectId', 'Proyecto', { type: 'select', options: projects.data.map((p) => ({ value: p.id, label: p.name })) }),
        field('responsibleId', 'Responsable', { type: 'select', options: employees.data.map((e) => ({ value: e.id, label: `${e.firstName} ${e.lastName}` })) }),
        field('brand', 'Marca'),
        field('model', 'Modelo'),
        field('serialNumber', 'Número de serie'),
        field('status', 'Estado', { type: 'select', options: STATUS }),
        field('operatingHours', 'Horas de operación', { type: 'number', min: 0, step: '0.01' }),
        field('purchaseDate', 'Fecha de compra', { type: 'date' }),
        field('notes', 'Notas', { type: 'textarea', full: true }),
      ],
    };
    if (modal.kind === 'category') return {
      title: modal.item ? 'Editar categoría' : 'Nueva categoría',
      fields: [field('code', 'Código', { required: true }), field('name', 'Nombre', { required: true }), field('description', 'Descripción', { type: 'textarea', full: true })],
    };
    if (modal.kind === 'reading') return {
      title: `Registrar lectura · ${(modal.item as Equipment).name}`,
      fields: [field('readAt', 'Fecha de lectura', { type: 'datetime-local', required: true }), field('hours', 'Horómetro (horas)', { type: 'number', required: true, min: 0, step: '0.01' }), field('notes', 'Notas', { type: 'textarea', full: true })],
    };
    return {
      title: `Registrar combustible · ${(modal.item as Equipment).name}`,
      fields: [field('date', 'Fecha', { type: 'date', required: true }), field('liters', 'Litros', { type: 'number', required: true, min: 0, step: '0.001' }), field('cost', 'Costo', { type: 'number', min: 0, step: '0.01' }), field('station', 'Estación'), field('notes', 'Notas', { type: 'textarea', full: true })],
    };
  }

  const form = modalFields();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Maquinaria"
        description="Inventario de equipos, lecturas horarias y registro de combustible."
        actions={<Button onClick={() => setModal({ kind: 'equipment', item: null })}><Plus className="h-4 w-4" /> Nueva maquinaria</Button>}
      />

      <div className="flex gap-1 border-b border-slate-200">
        {(['equipment', 'categories'] as const).map((value) => (
          <button key={value} type="button" onClick={() => setTab(value)} className={`border-b-2 px-4 py-2.5 text-sm font-semibold ${tab === value ? 'border-amber-500 text-amber-700' : 'border-transparent text-slate-500'}`}>
            {value === 'equipment' ? 'Equipos' : 'Categorías'}
          </button>
        ))}
      </div>

      {tab === 'equipment' ? (
        <ResourceTable
          data={filtered}
          columns={equipmentColumns}
          loading={equipment.loading}
          error={equipment.error}
          onRetry={equipment.reload}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Buscar equipos…"
          filters={[
            { key: 'status', label: 'Estado', value: status, options: STATUS, onChange: setStatus },
            { key: 'project', label: 'Proyecto', value: projectId, options: projects.data.map((p) => ({ value: p.id, label: p.name })), onChange: setProjectId },
          ]}
          getRowKey={(row) => row.id}
          emptyTitle="No hay maquinaria"
          emptyDescription="Registre el primer equipo del inventario."
        />
      ) : (
        <ResourceTable data={categories.data} columns={categoryColumns} loading={categories.loading} error={categories.error} onRetry={categories.reload} search={search} onSearchChange={setSearch} searchPlaceholder="Buscar categorías…" getRowKey={(row) => row.id} emptyTitle="No hay categorías" emptyDescription="Cree categorías para clasificar la maquinaria." />
      )}

      <FormModal
        open={!!modal}
        onOpenChange={(open) => !open && setModal(null)}
        title={form.title}
        initialValues={modal?.item ?? (modal?.kind === 'equipment' ? { status: 'OPERATIONAL', operatingHours: 0 } : modal?.kind === 'reading' ? { readAt: new Date().toISOString().slice(0, 16) } : modal?.kind === 'fuel' ? { date: todayInput() } : {})}
        fields={form.fields}
        onSubmit={save}
        submitLabel={modal?.kind === 'reading' || modal?.kind === 'fuel' ? 'Registrar' : 'Guardar'}
      />
      <ConfirmDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)} title="Eliminar registro" description={`¿Eliminar “${deleting?.name ?? ''}”?`} onConfirm={remove} />

      <Dialog open={!!history} onOpenChange={(open) => !open && setHistory(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Historial de {history?.name}</DialogTitle>
            <DialogDescription>Lecturas de horómetro y registros de combustible.</DialogDescription>
          </DialogHeader>
          {historyLoading && <p className="py-6 text-center text-sm text-slate-400">Cargando historial…</p>}
          {!historyLoading && (
            <div className="grid gap-4 md:grid-cols-2">
              <Card><CardHeader><CardTitle className="text-sm">Lecturas</CardTitle></CardHeader><CardContent className="space-y-2 text-xs">
                {readings.length === 0 && <p className="text-slate-400">Sin lecturas.</p>}
                {readings.map((row, index) => {
                  const item = row as Record<string, unknown>;
                  return <div key={item.id ? String(item.id) : index} className="flex justify-between border-b border-slate-50 py-1"><span>{formatDate(item.readAt)}</span><span className="font-semibold">{formatNumber(item.hours)} h</span></div>;
                })}
              </CardContent></Card>
              <Card><CardHeader><CardTitle className="text-sm">Combustible</CardTitle></CardHeader><CardContent className="space-y-2 text-xs">
                {fuels.length === 0 && <p className="text-slate-400">Sin registros.</p>}
                {fuels.map((row, index) => {
                  const item = row as Record<string, unknown>;
                  return <div key={item.id ? String(item.id) : index} className="flex justify-between border-b border-slate-50 py-1"><span>{formatDate(item.date)}</span><span className="font-semibold">{formatNumber(item.liters, 3)} L</span></div>;
                })}
              </CardContent></Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
