'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, FileSpreadsheet, FileText, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { PageHeader } from '@/components/shared/page-header';
import { ResourceTable, type Column } from '@/components/shared/resource-table';
import { api } from '@/lib/api';
import { listOf } from '@/lib/utils';
import { label } from '@/lib/format';

const REPORT_TYPES = [
  { value: 'production-by-project', label: 'Producción por proyecto' },
  { value: 'production-by-mine', label: 'Producción por yacimiento' },
  { value: 'production-by-shift', label: 'Producción por turno' },
  { value: 'production-by-activity', label: 'Producción por actividad' },
  { value: 'equipment-performance', label: 'Rendimiento de maquinaria' },
  { value: 'equipment-hours', label: 'Horas de maquinaria' },
  { value: 'crew-activity', label: 'Actividad de cuadrillas' },
  { value: 'reports', label: 'Resumen de partes' },
  { value: 'targets-vs-actual', label: 'Objetivos vs. real' },
];

type Row = Record<string, unknown>;

export default function ReportsPage() {
  const { success, error: toastError } = useToast();
  const [type, setType] = useState('production-by-project');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    api.get<unknown>(`/analytics/${type}`, { from, to }, controller.signal)
      .then((response) => {
        if (!controller.signal.aborted) setData(listOf<Row>(response));
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setData([]);
          setError(err instanceof Error ? err.message : 'No se pudo cargar el reporte');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [type, from, to, tick]);

  const keys = useMemo(() => {
    const set = new Set<string>();
    data.slice(0, 20).forEach((row) => Object.keys(row).forEach((key) => set.add(key)));
    return Array.from(set).slice(0, 10);
  }, [data]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return data;
    return data.filter((row) => Object.values(row).some((value) => String(value ?? '').toLowerCase().includes(term)));
  }, [data, search]);

  const columns: Array<Column<Row>> = keys.map((key) => ({
    key,
    header: label(key),
    render: (row) => {
      const value = row[key];
      if (value && typeof value === 'object') return <span className="text-xs">{JSON.stringify(value)}</span>;
      if (typeof value === 'number') return <span className="font-semibold tabular-nums">{value.toLocaleString('es-CL', { maximumFractionDigits: 3 })}</span>;
      return <span>{String(value ?? '—')}</span>;
    },
  }));

  async function exportFile(format: 'csv' | 'xlsx') {
    try {
      await api.download('/analytics/export', { type, format, from, to }, `reporte-${type}.${format}`, format);
      success('Descarga iniciada', `Reporte ${type} en formato ${format.toUpperCase()}`);
    } catch (err) {
      toastError('No se pudo exportar el reporte', err instanceof Error ? err.message : undefined);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reportes y analítica"
        description="Consulte indicadores agregados y exporte la información para análisis externo."
      />

      <Card>
        <CardHeader><CardTitle className="text-sm">Configuración del reporte</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="w-full md:w-72">
            <label className="mb-1 block text-xs font-medium text-slate-500">Tipo de reporte</label>
            <Select value={type} onChange={(event) => setType(event.target.value)} options={REPORT_TYPES} />
          </div>
          <div className="w-full md:w-44">
            <label className="mb-1 block text-xs font-medium text-slate-500">Desde</label>
            <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </div>
          <div className="w-full md:w-44">
            <label className="mb-1 block text-xs font-medium text-slate-500">Hasta</label>
            <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </div>
          <Button variant="outline" onClick={() => setTick((value) => value + 1)}><RefreshCw className="h-4 w-4" /> Actualizar</Button>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{filtered.length} filas</Badge>
          <span className="text-sm text-slate-500">{REPORT_TYPES.find((item) => item.value === type)?.label}</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void exportFile('csv')}><FileText className="h-4 w-4" /> Exportar CSV</Button>
          <Button size="sm" className="bg-emerald-800 hover:bg-emerald-900" onClick={() => void exportFile('xlsx')}><FileSpreadsheet className="h-4 w-4" /> Exportar Excel</Button>
        </div>
      </div>

      {columns.length > 0 ? (
        <ResourceTable
          data={filtered}
          columns={columns}
          loading={loading}
          error={error}
          onRetry={() => setTick((value) => value + 1)}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Filtrar resultados…"
          getRowKey={(row) => String(row.id ?? JSON.stringify(row))}
          emptyTitle="Sin resultados"
          emptyDescription="No hay datos para el reporte y período seleccionados."
        />
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
            {loading ? <p className="text-sm text-slate-500">Cargando reporte…</p> : (
              <>
                <Download className="h-8 w-8 text-slate-300" />
                <p className="text-sm font-semibold text-slate-700">{error ?? 'No hay resultados para mostrar'}</p>
                {error && <Button variant="outline" size="sm" onClick={() => setTick((value) => value + 1)}>Reintentar</Button>}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
