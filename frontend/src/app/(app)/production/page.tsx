'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { PageHeader } from '@/components/shared/page-header';
import { ResourceTable, StatusCell, type Column } from '@/components/shared/resource-table';
import { FormModal, field, type FormField, type FormValues } from '@/components/shared/form-modal';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { useApiList } from '@/hooks/use-api';
import { api, type Mine, type ProductionIndicator, type ProductionRecord, type ProductionTarget, type ProductionUnit, type Project } from '@/lib/api';
import { chartPoints, findArray, firstNumber } from '@/lib/data';
import { formatNumber, label } from '@/lib/format';

type Tab = 'indicators' | 'units' | 'targets' | 'records';
type Entity = Exclude<Tab, 'records'>;

const CATEGORIES = ['MASS', 'VOLUME', 'LENGTH', 'TIME', 'COUNT'].map((value) => ({ value, label: label(value) }));
const PERIODS = ['DAILY', 'WEEKLY', 'MONTHLY'].map((value) => ({ value, label: label(value) }));

interface ModalState { entity: Entity; item: ProductionUnit | ProductionIndicator | ProductionTarget | null }
interface DeleteState { entity: Entity; id: string; name: string }

export default function ProductionPage() {
  const { success, error: toastError } = useToast();
  const [tab, setTab] = useState<Tab>('indicators');
  const [modal, setModal] = useState<ModalState | null>(null);
  const [deleting, setDeleting] = useState<DeleteState | null>(null);
  const [search, setSearch] = useState('');
  const [indicatorFilter, setIndicatorFilter] = useState('');
  const [summary, setSummary] = useState<unknown>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const units = useApiList<ProductionUnit>('/production/units');
  const indicators = useApiList<ProductionIndicator>('/production/indicators');
  const targets = useApiList<ProductionTarget>('/production/targets');
  const projects = useApiList<Project>('/projects');
  const mines = useApiList<Mine>('/mines');
  const records = useApiList<ProductionRecord>('/production/records', { indicatorId: indicatorFilter });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    if (q) setSearch(q);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setSummaryLoading(true);
    setSummaryError(null);
    api.get<unknown>('/production/summary', undefined, controller.signal)
      .then((response) => { if (!controller.signal.aborted) setSummary(response); })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setSummaryError(err instanceof Error ? err.message : 'No se pudo cargar el resumen');
      })
      .finally(() => { if (!controller.signal.aborted) setSummaryLoading(false); });
    return () => controller.abort();
  }, [tick]);

  const comparison = useMemo(() => {
    const rows = findArray(summary, ['targetsVsActual', 'targetVsActual', 'comparison', 'targets', 'byIndicator', 'indicators']);
    return rows.map((row) => {
      const obj = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
      const labelValue = String(obj.name ?? obj.indicatorName ?? obj.label ?? obj.code ?? obj.indicator ?? '—').slice(0, 18);
      return {
        label: labelValue,
        Objetivo: firstNumber(row, ['target', 'targetValue', 'goal', 'planned']),
        Real: firstNumber(row, ['actual', 'real', 'value', 'production', 'total']),
      };
    }).filter((row) => row.Objetivo > 0 || row.Real > 0);
  }, [summary]);

  const summaryText = useMemo(() => {
    const points = chartPoints(findArray(summary, ['totals', 'summary']), ['name', 'label', 'indicator'], ['value', 'total', 'actual']);
    return points;
  }, [summary]);

  function fieldsFor(entity: Entity, item: ModalState['item']): FormField[] {
    const base = item as Record<string, unknown> | null;
    if (entity === 'units') return [
      field('code', 'Código', { required: true, placeholder: 'TN' }),
      field('name', 'Nombre', { required: true, placeholder: 'Toneladas' }),
      field('symbol', 'Símbolo', { required: true, placeholder: 't' }),
      field('category', 'Categoría', { type: 'select', required: true, options: CATEGORIES, ...(base?.category ? {} : {}) }),
      field('factorToBaseUnit', 'Factor a unidad base', { type: 'number', step: '0.000001', required: true, ...(base?.factorToBaseUnit ? {} : {}) }),
      field('active', 'Activa', { type: 'checkbox' }),
    ];
    if (entity === 'indicators') return [
      field('unitId', 'Unidad', { type: 'select', required: true, options: units.data.map((u) => ({ value: u.id, label: `${u.name} (${u.symbol})` })) }),
      field('code', 'Código', { required: true, placeholder: 'TON-MIN' }),
      field('name', 'Nombre', { required: true }),
      field('category', 'Categoría', { type: 'select', required: true, options: CATEGORIES }),
      field('description', 'Descripción', { type: 'textarea', full: true }),
      field('active', 'Activa', { type: 'checkbox' }),
    ];
    return [
      field('projectId', 'Proyecto', { type: 'select', required: true, options: projects.data.map((p) => ({ value: p.id, label: p.name })) }),
      field('mineId', 'Yacimiento', { type: 'select', options: mines.data.map((m) => ({ value: m.id, label: m.name })) }),
      field('indicatorId', 'Indicador', { type: 'select', required: true, options: indicators.data.map((i) => ({ value: i.id, label: i.name })) }),
      field('period', 'Período', { type: 'select', required: true, options: PERIODS }),
      field('year', 'Año', { type: 'number', required: true, min: 2000, max: 2100, ...(base?.year ? {} : {}) }),
      field('month', 'Mes (1–12)', { type: 'number', min: 1, max: 12 }),
      field('day', 'Día (1–31)', { type: 'number', min: 1, max: 31 }),
      field('targetValue', 'Valor objetivo', { type: 'number', step: '0.001', required: true }),
    ];
  }

  async function save(values: FormValues) {
    if (!modal) return;
    const { entity, item } = modal;
    let payload: Record<string, unknown> = {};
    if (entity === 'units') payload = {
      code: String(values.code).trim(),
      name: String(values.name).trim(),
      symbol: String(values.symbol).trim(),
      category: String(values.category),
      factorToBaseUnit: Number(values.factorToBaseUnit),
      active: Boolean(values.active),
    };
    if (entity === 'indicators') payload = {
      unitId: String(values.unitId),
      code: String(values.code).trim(),
      name: String(values.name).trim(),
      category: String(values.category),
      description: values.description ? String(values.description) : null,
      active: Boolean(values.active),
    };
    if (entity === 'targets') payload = {
      projectId: String(values.projectId),
      mineId: values.mineId ? String(values.mineId) : null,
      indicatorId: String(values.indicatorId),
      period: String(values.period),
      year: Number(values.year),
      month: values.month === '' ? null : Number(values.month),
      day: values.day === '' ? null : Number(values.day),
      targetValue: Number(values.targetValue),
    };
    const path = `/production/${entity}${item ? `/${item.id}` : ''}`;
    if (item) await api.patch(path, payload);
    else await api.post(path, payload);
    success(item ? 'Registro actualizado' : 'Registro creado', String(values.name ?? values.code ?? ''));
    setModal(null);
    setTick((value) => value + 1);
    ({ units, indicators, targets })[entity].reload();
  }

  async function remove() {
    if (!deleting) return;
    try {
      await api.delete(`/production/${deleting.entity}/${deleting.id}`);
      success('Registro eliminado', deleting.name);
      ({ units, indicators, targets })[deleting.entity].reload();
      setTick((value) => value + 1);
    } catch (err) {
      toastError('No se pudo eliminar el registro', err instanceof Error ? err.message : undefined);
      throw err;
    }
  }

  function initialFor(entity: Entity, item: ModalState['item']) {
    const values: Record<string, unknown> = item ?? {};
    if (entity === 'targets' && !item) values.period = 'MONTHLY';
    if ((entity === 'targets' || entity === 'indicators') && !item && projects.data[0]) values.projectId = projects.data[0].id;
    if (entity === 'units' && !item) values.active = true;
    if (entity === 'indicators' && !item) values.active = true;
    return values;
  }

  const unitColumns: Array<Column<ProductionUnit>> = [
    { key: 'code', header: 'Código', render: (row) => <span className="font-mono text-xs font-semibold text-amber-700">{row.code}</span> },
    { key: 'name', header: 'Unidad', render: (row) => `${row.name} (${row.symbol})` },
    { key: 'category', header: 'Categoría', render: (row) => label(row.category) },
    { key: 'factor', header: 'Factor', render: (row) => formatNumber(row.factorToBaseUnit, 6) },
    { key: 'active', header: 'Estado', render: (row) => <Badge variant={row.active ? 'success' : 'neutral'}>{row.active ? 'Activa' : 'Inactiva'}</Badge> },
    { key: 'actions', header: 'Acciones', render: (row) => <Actions onEdit={() => setModal({ entity: 'units', item: row })} onDelete={() => setDeleting({ entity: 'units', id: row.id, name: row.name })} /> },
  ];

  const indicatorColumns: Array<Column<ProductionIndicator>> = [
    { key: 'code', header: 'Código', render: (row) => <span className="font-mono text-xs font-semibold text-amber-700">{row.code}</span> },
    { key: 'name', header: 'Indicador', render: (row) => <div><p className="font-semibold">{row.name}</p><p className="text-xs text-slate-400">{row.description ?? ''}</p></div> },
    { key: 'unit', header: 'Unidad', render: (row) => row.unit?.symbol ?? '—' },
    { key: 'category', header: 'Categoría', render: (row) => label(row.category) },
    { key: 'active', header: 'Estado', render: (row) => <Badge variant={row.active ? 'success' : 'neutral'}>{row.active ? 'Activo' : 'Inactivo'}</Badge> },
    { key: 'actions', header: 'Acciones', render: (row) => <Actions onEdit={() => setModal({ entity: 'indicators', item: row })} onDelete={() => setDeleting({ entity: 'indicators', id: row.id, name: row.name })} /> },
  ];

  const targetColumns: Array<Column<ProductionTarget>> = [
    { key: 'project', header: 'Proyecto', render: (row) => row.project?.name ?? projects.data.find((p) => p.id === row.projectId)?.name ?? '—' },
    { key: 'indicator', header: 'Indicador', render: (row) => row.indicator?.name ?? indicators.data.find((i) => i.id === row.indicatorId)?.name ?? '—' },
    { key: 'period', header: 'Período', render: (row) => `${label(row.period)} ${row.year}${row.month ? `-${String(row.month).padStart(2, '0')}` : ''}${row.day ? `-${String(row.day).padStart(2, '0')}` : ''}` },
    { key: 'value', header: 'Objetivo', render: (row) => <span className="font-semibold">{formatNumber(row.targetValue, 3)}</span> },
    { key: 'actions', header: 'Acciones', render: (row) => <Actions onEdit={() => setModal({ entity: 'targets', item: row })} onDelete={() => setDeleting({ entity: 'targets', id: row.id, name: `Objetivo ${row.year}` })} /> },
  ];

  const recordColumns: Array<Column<ProductionRecord>> = [
    { key: 'indicator', header: 'Indicador', render: (row) => row.indicator?.name ?? indicators.data.find((i) => i.id === row.indicatorId)?.name ?? row.indicatorId },
    { key: 'unit', header: 'Unidad', render: (row) => row.unit?.symbol ?? '—' },
    { key: 'value', header: 'Valor', render: (row) => <span className="font-semibold">{formatNumber(row.value, 3)}</span> },
    { key: 'date', header: 'Registrado', render: (row) => row.recordedAt ? new Date(row.recordedAt).toLocaleDateString('es-CL') : '—' },
    { key: 'notes', header: 'Notas', render: (row) => row.notes ?? '—' },
  ];

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'indicators', label: 'Indicadores' },
    { id: 'units', label: 'Unidades' },
    { id: 'targets', label: 'Objetivos' },
    { id: 'records', label: 'Registros' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Producción"
        description="Configuración de indicadores, unidades, objetivos y registros de producción."
        actions={
          tab !== 'records' ? (
            <Button onClick={() => setModal({ entity: tab, item: null })}>
              <Plus className="h-4 w-4" /> Nuevo {tab === 'indicators' ? 'indicador' : tab === 'units' ? 'unidad' : 'objetivo'}
            </Button>
          ) : undefined
        }
      />

      <Card>
        <CardHeader><CardTitle className="text-sm">Resumen de producción</CardTitle></CardHeader>
        <CardContent>
          {summaryError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{summaryError}</p>}
          {summaryLoading ? <Skeleton className="h-56 w-full" /> : comparison.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparison} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip formatter={(value) => formatNumber(Number(value), 2)} />
                  <Legend />
                  <Bar dataKey="Objetivo" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Real" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : summaryText.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-3">
              {summaryText.map((point) => (
                <div key={point.label} className="rounded-lg border border-slate-100 p-3">
                  <p className="text-xs text-slate-500">{point.label}</p>
                  <p className="text-lg font-bold text-slate-800">{formatNumber(point.value)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-slate-400">Sin datos de resumen disponibles.</p>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => { setTab(item.id); setSearch(''); }}
            className={`border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${tab === item.id ? 'border-amber-500 text-amber-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'indicators' && (
        <ResourceTable data={indicators.data.filter((row) => !search || `${row.name} ${row.code}`.toLowerCase().includes(search.toLowerCase()))} columns={indicatorColumns} loading={indicators.loading} error={indicators.error} onRetry={indicators.reload} search={search} onSearchChange={setSearch} searchPlaceholder="Buscar indicadores…" getRowKey={(row) => row.id} emptyTitle="No hay indicadores" emptyDescription="Cree un indicador para registrar producción." />
      )}
      {tab === 'units' && (
        <ResourceTable data={units.data.filter((row) => !search || `${row.name} ${row.code}`.toLowerCase().includes(search.toLowerCase()))} columns={unitColumns} loading={units.loading} error={units.error} onRetry={units.reload} search={search} onSearchChange={setSearch} searchPlaceholder="Buscar unidades…" getRowKey={(row) => row.id} emptyTitle="No hay unidades" emptyDescription="Cree una unidad de medida." />
      )}
      {tab === 'targets' && (
        <ResourceTable data={targets.data.filter((row) => !search || `${row.indicator?.name ?? ''} ${row.project?.name ?? ''}`.toLowerCase().includes(search.toLowerCase()))} columns={targetColumns} loading={targets.loading} error={targets.error} onRetry={targets.reload} search={search} onSearchChange={setSearch} searchPlaceholder="Buscar objetivos…" getRowKey={(row) => row.id} emptyTitle="No hay objetivos" emptyDescription="Defina objetivos de producción por período." />
      )}
      {tab === 'records' && (
        <>
          <p className="text-xs text-slate-500">Los registros se generan a partir de los partes aprobados y no se editan directamente.</p>
          <ResourceTable
            data={records.data}
            columns={recordColumns}
            loading={records.loading}
            error={records.error}
            onRetry={records.reload}
            filters={[{ key: 'indicator', label: 'Indicador', value: indicatorFilter, options: indicators.data.map((i) => ({ value: i.id, label: i.name })), onChange: setIndicatorFilter }]}
            getRowKey={(row) => row.id}
            emptyTitle="No hay registros"
            emptyDescription="Los registros aparecerán cuando se aprueben partes con producción."
          />
        </>
      )}

      <FormModal
        open={!!modal}
        onOpenChange={(open) => !open && setModal(null)}
        title={modal ? `${modal.item ? 'Editar' : 'Nuevo'} ${modal.entity === 'units' ? 'unidad' : modal.entity === 'targets' ? 'objetivo' : 'indicador'}` : ''}
        initialValues={modal ? initialFor(modal.entity, modal.item) : {}}
        fields={modal ? fieldsFor(modal.entity, modal.item) : []}
        onSubmit={save}
        submitLabel="Guardar"
      />
      <ConfirmDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)} title="Eliminar registro" description={`¿Eliminar “${deleting?.name ?? ''}”?`} onConfirm={remove} />
    </div>
  );
}

function Actions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex justify-end gap-1">
      <Button variant="ghost" size="icon" onClick={onEdit} aria-label="Editar"><Pencil className="h-4 w-4" /></Button>
      <Button variant="ghost" size="icon" onClick={onDelete} aria-label="Eliminar" className="text-red-500"><Trash2 className="h-4 w-4" /></Button>
    </div>
  );
}
