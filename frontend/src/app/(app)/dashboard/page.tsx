'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Factory,
  FolderKanban,
  Mountain,
  RefreshCw,
  TrendingUp,
  Truck,
  type LucideIcon,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/page-header';
import { StatusCell } from '@/components/shared/resource-table';
import { useApiList } from '@/hooks/use-api';
import { useAuth } from '@/lib/auth';
import { api, type Area, type Mine, type OperationReport, type Project } from '@/lib/api';
import { chartPoints, findArray, findNumber } from '@/lib/data';
import { formatDate, formatNumber, label } from '@/lib/format';

interface Kpi {
  title: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  tone: string;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const tenantId = user?.tenantId;
  const projects = useApiList<Project>(tenantId ? '/projects' : null);
  const mines = useApiList<Mine>(tenantId ? '/mines' : null);
  const reports = useApiList<OperationReport>(tenantId ? '/reports' : null);
  const [projectId, setProjectId] = useState('');
  const [mineId, setMineId] = useState('');
  const [areaId, setAreaId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const areas = useApiList<Area>(tenantId && mineId ? '/areas' : null, { mineId });

  useEffect(() => {
    if (!tenantId) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(null);
    api
      .get<unknown>('/dashboard', { projectId, mineId, areaId, from, to }, controller.signal)
      .then((response) => {
        if (active) setData(response);
      })
      .catch((err: unknown) => {
        if (!active || controller.signal.aborted) return;
        setData(null);
        setError(err instanceof Error ? err.message : 'No se pudo cargar el dashboard');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [tenantId, projectId, mineId, areaId, from, to, tick]);

  const lineData = useMemo(
    () =>
      chartPoints(
        findArray(data, ['productionByDay', 'dailyProduction', 'productionLastDays', 'productionSeries', 'production']),
        ['date', 'day', 'fecha', 'label'],
        ['value', 'total', 'production', 'amount', 'tons'],
      ),
    [data],
  );
  const barData = useMemo(
    () =>
      chartPoints(
        findArray(data, ['productionByIndicator', 'indicators', 'byIndicator']),
        ['name', 'indicator', 'label', 'code'],
        ['value', 'total', 'production', 'quantity'],
      ),
    [data],
  );

  const pendingReports = useMemo(
    () => reports.data.filter((report) => ['SUBMITTED', 'UNDER_REVIEW', 'DRAFT'].includes(String(report.status))).slice(0, 6),
    [reports.data],
  );

  const kpis: Kpi[] = [
    {
      title: 'Proyectos activos',
      value: formatNumber(findNumber(data, ['activeProjects', 'projectsActive', 'activeProjectsCount']) ?? projects.data.filter((p) => p.status === 'ACTIVE').length, 0),
      hint: 'Proyectos en ejecución',
      icon: FolderKanban,
      tone: 'bg-emerald-50 text-emerald-700',
    },
    {
      title: 'Producción acumulada',
      value: formatNumber(findNumber(data, ['totalProduction', 'productionTotal', 'production']) ?? 0, 1),
      hint: 'Según filtros seleccionados',
      icon: Factory,
      tone: 'bg-amber-50 text-amber-700',
    },
    {
      title: 'Partes pendientes',
      value: formatNumber(findNumber(data, ['pendingReports', 'reportsPending', 'pending']) ?? pendingReports.length, 0),
      hint: 'Requieren revisión o aprobación',
      icon: ClipboardList,
      tone: 'bg-sky-50 text-sky-700',
    },
    {
      title: 'Yacimientos activos',
      value: formatNumber(findNumber(data, ['activeMines', 'minesActive']) ?? mines.data.filter((m) => m.status === 'ACTIVE').length, 0),
      hint: 'Operaciones habilitadas',
      icon: Mountain,
      tone: 'bg-violet-50 text-violet-700',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard ejecutivo"
        description="Indicadores clave de la operación minera en el período seleccionado."
        actions={
          <Button variant="outline" size="sm" onClick={() => setTick((value) => value + 1)}>
            <RefreshCw className="h-4 w-4" /> Actualizar
          </Button>
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:flex-wrap md:items-end">
          <div className="w-full md:w-48">
            <label className="mb-1 block text-xs font-medium text-slate-500">Proyecto</label>
            <Select value={projectId} onChange={(event) => { setProjectId(event.target.value); setMineId(''); setAreaId(''); }} placeholder="Todos los proyectos" options={projects.data.map((p) => ({ value: p.id, label: p.name }))} />
          </div>
          <div className="w-full md:w-48">
            <label className="mb-1 block text-xs font-medium text-slate-500">Yacimiento</label>
            <Select value={mineId} onChange={(event) => { setMineId(event.target.value); setAreaId(''); }} placeholder="Todos los yacimientos" options={mines.data.filter((m) => !projectId || m.projectId === projectId).map((m) => ({ value: m.id, label: m.name }))} />
          </div>
          <div className="w-full md:w-48">
            <label className="mb-1 block text-xs font-medium text-slate-500">Sector</label>
            <Select value={areaId} onChange={(event) => setAreaId(event.target.value)} placeholder="Todos los sectores" options={areas.data.map((a) => ({ value: a.id, label: a.name }))} />
          </div>
          <div className="w-full md:w-40">
            <label className="mb-1 block text-xs font-medium text-slate-500">Desde</label>
            <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </div>
          <div className="w-full md:w-40">
            <label className="mb-1 block text-xs font-medium text-slate-500">Hasta</label>
            <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </div>
          {(projectId || mineId || areaId || from || to) && (
            <Button variant="ghost" size="sm" onClick={() => { setProjectId(''); setMineId(''); setAreaId(''); setFrom(''); setTo(''); }}>
              Limpiar filtros
            </Button>
          )}
        </CardContent>
      </Card>

      {!tenantId && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          Selecciona una empresa activa en el menú superior para ver los indicadores operativos.
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-32" />)
          : kpis.map((kpi) => {
              const Icon = kpi.icon;
              return (
                <Card key={kpi.title}>
                  <CardContent className="flex items-start justify-between gap-3 p-5">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{kpi.title}</p>
                      <p className="mt-2 text-3xl font-bold text-slate-900">{kpi.value}</p>
                      <p className="mt-1 text-xs text-slate-400">{kpi.hint}</p>
                    </div>
                    <div className={`rounded-xl p-3 ${kpi.tone}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-amber-600" /> Producción por día
            </CardTitle>
            <CardDescription>Serie histórica devuelta por el servicio de dashboard.</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {loading ? (
              <Skeleton className="h-full w-full" />
            ) : lineData.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-slate-400">Sin datos de producción para el período</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip formatter={(value) => formatNumber(Number(value))} />
                  <Line type="monotone" dataKey="value" name="Producción" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Factory className="h-4 w-4 text-emerald-700" /> Producción por indicador
            </CardTitle>
            <CardDescription>Distribución de los indicadores informados.</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {loading ? (
              <Skeleton className="h-full w-full" />
            ) : barData.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-slate-400">Sin datos de indicadores para el período</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip formatter={(value) => formatNumber(Number(value))} />
                  <Legend />
                  <Bar dataKey="value" name="Valor" fill="#065f46" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Partes pendientes</CardTitle>
            <CardDescription>Últimos partes que requieren atención.</CardDescription>
          </div>
          <Button asChild variant="link" size="sm">
            <Link href="/operations">Ver operaciones <ArrowUpRight className="h-4 w-4" /></Link>
          </Button>
        </CardHeader>
        <CardContent>
          {reports.loading ? (
            <Skeleton className="h-32 w-full" />
          ) : reports.error ? (
            <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{reports.error}</p>
          ) : pendingReports.length === 0 ? (
            <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
              <CheckCircle2 className="h-5 w-5" /> No hay partes pendientes de revisión.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr className="border-b border-slate-100">
                    <th className="py-2 pr-4">Código</th>
                    <th className="py-2 pr-4">Fecha</th>
                    <th className="py-2 pr-4">Proyecto</th>
                    <th className="py-2 pr-4">Turno</th>
                    <th className="py-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingReports.map((report) => (
                    <tr key={report.id} className="border-b border-slate-50 last:border-0">
                      <td className="py-2.5 pr-4 font-medium text-slate-800">
                        <Link href={`/operations?report=${report.id}`} className="text-amber-700 hover:underline">{report.code}</Link>
                      </td>
                      <td className="py-2.5 pr-4"><CalendarDays className="mr-1 inline h-3.5 w-3.5 text-slate-400" />{formatDate(report.date)}</td>
                      <td className="py-2.5 pr-4">{report.project?.name ?? '—'}</td>
                      <td className="py-2.5 pr-4">{label(report.shift?.type ?? report.shiftId)}</td>
                      <td className="py-2.5"><StatusCell value={report.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: Truck, title: 'Maquinaria', text: 'Revise disponibilidad y registros de combustible.', href: '/equipment' },
          { icon: Mountain, title: 'Yacimientos', text: 'Supervise sectores y frentes de extracción.', href: '/mines' },
          { icon: Factory, title: 'Producción', text: 'Compare avance real contra objetivos.', href: '/production' },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.title} href={item.href} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-amber-300 hover:bg-amber-50/40">
              <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700"><Icon className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                <p className="mt-0.5 text-xs text-slate-500">{item.text}</p>
              </div>
              <ArrowUpRight className="h-4 w-4 text-slate-400" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
