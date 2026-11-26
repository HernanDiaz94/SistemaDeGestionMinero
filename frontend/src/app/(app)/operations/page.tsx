'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  CheckCircle2,
  ClipboardCheck,
  Download,
  Eye,
  FileText,
  Paperclip,
  Plus,
  Send,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { PageHeader } from '@/components/shared/page-header';
import { ResourceTable, StatusCell, type Column } from '@/components/shared/resource-table';
import { FormModal, field, type FormValues } from '@/components/shared/form-modal';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { ReportWizard } from '@/components/forms/report-wizard';
import { useApiList } from '@/hooks/use-api';
import { useAuth } from '@/lib/auth';
import { api, type OperationReport, type Project, type ReportApproval, type ReportAttachment, type ReportRevision } from '@/lib/api';
import { formatDate, formatDateTime, label } from '@/lib/format';
import { asString, listOf } from '@/lib/utils';

type ActionKind = 'submit' | 'review' | 'approve' | 'reject';

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Borrador' },
  { value: 'SUBMITTED', label: 'Enviado' },
  { value: 'UNDER_REVIEW', label: 'En revisión' },
  { value: 'APPROVED', label: 'Aprobado' },
  { value: 'REJECTED', label: 'Rechazado' },
];

export default function OperationsPage() {
  const { can } = useAuth();
  const { success, error: toastError } = useToast();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [projectId, setProjectId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [deleting, setDeleting] = useState<OperationReport | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<OperationReport | null>(null);
  const [attachments, setAttachments] = useState<ReportAttachment[]>([]);
  const [revisions, setRevisions] = useState<ReportRevision[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'resumen' | 'adjuntos' | 'revisiones'>('resumen');
  const [action, setAction] = useState<{ report: OperationReport; kind: ActionKind } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingAttachment, setDeletingAttachment] = useState<ReportAttachment | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const projects = useApiList<Project>('/projects');
  const reports = useApiList<OperationReport>('/reports', {
    search,
    status,
    projectId,
    from,
    to,
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('report');
    if (id) setDetailId(id);
    const q = params.get('q');
    if (q) setSearch(q);
  }, []);

  async function loadDetail() {
    if (!detailId) return;
    setDetailLoading(true);
    setDetailError(null);
    try {
      const [report, files, history] = await Promise.all([
        api.get<OperationReport>(`/reports/${detailId}`),
        api.get<unknown>(`/reports/${detailId}/attachments`),
        api.get<unknown>(`/reports/${detailId}/revisions`),
      ]);
      setDetail(report);
      setAttachments(listOf<ReportAttachment>(files));
      setRevisions(listOf<ReportRevision>(history));
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'No se pudo cargar el parte');
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    void loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailId]);

  async function remove() {
    if (!deleting) return;
    try {
      await api.delete(`/reports/${deleting.id}`);
      success('Parte eliminado', deleting.code);
      reports.reload();
    } catch (err) {
      toastError('No se pudo eliminar el parte', err instanceof Error ? err.message : undefined);
      throw err;
    }
  }

  async function runAction(values: FormValues) {
    if (!action) return;
    const path = `/reports/${action.report.id}/${action.kind}`;
    const body = action.kind === 'submit' ? undefined : { comments: String(values.comments ?? '') };
    if (action.kind === 'reject' && !String(values.comments ?? '').trim()) return;
    try {
      await api.post(path, body);
      success('Acción registrada', `Parte ${action.report.code}: ${label(action.kind)}`);
      setAction(null);
      reports.reload();
      if (detailId) await loadDetail();
    } catch (err) {
      toastError('No se pudo completar la acción', err instanceof Error ? err.message : undefined);
      throw err;
    }
  }

  async function uploadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !detailId) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      await api.upload(`/reports/${detailId}/attachments`, form);
      success('Archivo adjuntado', file.name);
      await loadDetail();
    } catch (err) {
      toastError('No se pudo adjuntar el archivo', err instanceof Error ? err.message : undefined);
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  }

  async function removeAttachment() {
    if (!deletingAttachment || !detailId) return;
    try {
      await api.delete(`/reports/${detailId}/attachments/${deletingAttachment.id}`);
      success('Adjunto eliminado', deletingAttachment.fileName);
      await loadDetail();
    } catch (err) {
      toastError('No se pudo eliminar el adjunto', err instanceof Error ? err.message : undefined);
      throw err;
    }
  }

  async function downloadAttachment(attachment: ReportAttachment) {
    const key = asString(attachment.storageKey);
    try {
      await api.download(`/reports/files/${encodeURIComponent(key)}`, undefined, attachment.fileName);
    } catch (err) {
      toastError('No se pudo descargar el adjunto', err instanceof Error ? err.message : undefined);
    }
  }

  const columns: Array<Column<OperationReport>> = [
    { key: 'code', header: 'Parte', render: (row) => <span className="font-mono text-xs font-semibold text-amber-700">{row.code}</span> },
    { key: 'date', header: 'Fecha', render: (row) => formatDate(row.date) },
    { key: 'project', header: 'Proyecto / Mina', render: (row) => <div><p className="font-medium text-slate-800">{row.project?.name ?? '—'}</p><p className="text-xs text-slate-400">{row.mine?.name ?? ''}</p></div> },
    { key: 'shift', header: 'Turno', render: (row) => label(row.shift?.type) },
    { key: 'version', header: 'Versión', render: (row) => `v${row.version ?? 1}` },
    { key: 'status', header: 'Estado', render: (row) => <StatusCell value={row.status} /> },
    {
      key: 'actions',
      header: 'Acciones',
      render: (row) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" onClick={(event) => { event.stopPropagation(); setDetailId(row.id); setDetailTab('resumen'); }} aria-label="Ver detalle"><Eye className="h-4 w-4" /></Button>
          {row.status === 'DRAFT' && can('reports.submit') && <Button variant="ghost" size="icon" onClick={(event) => { event.stopPropagation(); setAction({ report: row, kind: 'submit' }); }} aria-label="Enviar parte" className="text-sky-600"><Send className="h-4 w-4" /></Button>}
          {row.status === 'SUBMITTED' && can('reports.review') && <Button variant="ghost" size="icon" onClick={(event) => { event.stopPropagation(); setAction({ report: row, kind: 'review' }); }} aria-label="Revisar parte" className="text-amber-600"><ClipboardCheck className="h-4 w-4" /></Button>}
          {row.status === 'UNDER_REVIEW' && can('reports.approve') && (
            <>
              <Button variant="ghost" size="icon" onClick={(event) => { event.stopPropagation(); setAction({ report: row, kind: 'approve' }); }} aria-label="Aprobar parte" className="text-emerald-600"><CheckCircle2 className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" onClick={(event) => { event.stopPropagation(); setAction({ report: row, kind: 'reject' }); }} aria-label="Rechazar parte" className="text-red-500"><XCircle className="h-4 w-4" /></Button>
            </>
          )}
          {can('reports.delete') && <Button variant="ghost" size="icon" onClick={(event) => { event.stopPropagation(); setDeleting(row); }} aria-label="Eliminar" className="text-red-500"><Trash2 className="h-4 w-4" /></Button>}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operaciones · Partes diarios"
        description="Registro, revisión y aprobación de las actividades diarias de la operación."
        actions={<Button onClick={() => setWizardOpen(true)}><Plus className="h-4 w-4" /> Nuevo parte</Button>}
      />

      <ResourceTable
        data={reports.data}
        columns={columns}
        loading={reports.loading}
        error={reports.error}
        onRetry={reports.reload}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por código…"
        filters={[
          { key: 'status', label: 'Estado', value: status, options: STATUS_OPTIONS, onChange: setStatus },
          { key: 'project', label: 'Proyecto', value: projectId, options: projects.data.map((p) => ({ value: p.id, label: p.name })), onChange: setProjectId },
        ]}
        toolbar={
          <div className="flex gap-2">
            <Input type="date" aria-label="Desde" value={from} onChange={(event) => setFrom(event.target.value)} className="w-40" />
            <Input type="date" aria-label="Hasta" value={to} onChange={(event) => setTo(event.target.value)} className="w-40" />
          </div>
        }
        getRowKey={(row) => row.id}
        emptyTitle="No hay partes registrados"
        emptyDescription="Cree un nuevo parte para comenzar el registro diario."
      />

      <ReportWizard open={wizardOpen} onOpenChange={setWizardOpen} onSaved={reports.reload} />
      <ConfirmDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)} title="Eliminar parte" description={`¿Eliminar el parte ${deleting?.code ?? ''}? Se borrarán sus registros asociados.`} onConfirm={remove} />

      <FormModal
        open={!!action}
        onOpenChange={(open) => !open && setAction(null)}
        title={`${action ? label(action.kind) : ''} de parte`}
        description={action ? `Parte ${action.report.code} · ${formatDate(action.report.date)}` : undefined}
        submitLabel={action?.kind === 'reject' ? 'Rechazar' : 'Confirmar'}
        initialValues={{ comments: '' }}
        onSubmit={runAction}
        fields={[
          field('comments', 'Comentarios', {
            type: 'textarea',
            full: true,
            required: action?.kind === 'reject',
            placeholder: action?.kind === 'reject' ? 'Indique el motivo del rechazo' : 'Observaciones opcionales',
          }),
        ]}
      />

      <Dialog open={!!detailId} onOpenChange={(open) => !open && setDetailId(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Detalle del parte {detail?.code ?? ''}</DialogTitle>
            <DialogDescription>
              {detail ? `${detail.project?.name ?? '—'} · ${detail.mine?.name ?? '—'} · ${formatDate(detail.date)}` : 'Consultando información del parte…'}
            </DialogDescription>
          </DialogHeader>

          {detailLoading && <Skeleton className="h-64 w-full" />}
          {detailError && <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{detailError}</p>}
          {detail && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <StatusCell value={detail.status} />
                <Badge variant="outline">Versión {detail.version ?? 1}</Badge>
                {detail.shift && <Badge variant="outline">Turno {detail.shift.name}</Badge>}
                {detail.supervisor && <Badge variant="outline">Supervisor: {detail.supervisor.email}</Badge>}
              </div>
              <div className="flex gap-1 border-b border-slate-100">
                {(['resumen', 'adjuntos', 'revisiones'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setDetailTab(tab)}
                    className={`border-b-2 px-3 py-2 text-sm font-medium capitalize ${detailTab === tab ? 'border-amber-500 text-amber-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {detailTab === 'resumen' && (
                <div className="max-h-96 space-y-4 overflow-y-auto text-sm">
                  <Card><CardHeader><CardTitle className="text-sm">Actividades</CardTitle></CardHeader><CardContent className="space-y-2">
                    {detail.activities?.length ? detail.activities.map((item, index) => (
                      <div key={item.id ?? index} className="flex justify-between gap-3 border-b border-slate-50 py-1">
                        <span>{item.description}</span><span className="text-xs text-slate-500">{item.hours ? `${item.hours} h` : ''}</span>
                      </div>
                    )) : <p className="text-slate-400">Sin actividades registradas.</p>}
                  </CardContent></Card>
                  <Card><CardHeader><CardTitle className="text-sm">Producción</CardTitle></CardHeader><CardContent className="space-y-2">
                    {detail.production?.length ? detail.production.map((item, index) => (
                      <div key={item.id ?? index} className="flex justify-between gap-3 border-b border-slate-50 py-1">
                        <span>{item.indicator?.name ?? item.indicatorId}</span><span className="font-semibold">{String(item.value)} {item.unit?.symbol ?? ''}</span>
                      </div>
                    )) : <p className="text-slate-400">Sin producción registrada.</p>}
                  </CardContent></Card>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card><CardHeader><CardTitle className="text-sm">Personal</CardTitle></CardHeader><CardContent>
                      {detail.employees?.length ? detail.employees.map((item, index) => <p key={item.id ?? index} className="py-1">{item.employee?.firstName ?? ''} {item.employee?.lastName ?? item.employeeId} · {item.hours ?? '—'} h</p>) : <p className="text-slate-400">Sin personal.</p>}
                    </CardContent></Card>
                    <Card><CardHeader><CardTitle className="text-sm">Maquinaria</CardTitle></CardHeader><CardContent>
                      {detail.equipment?.length ? detail.equipment.map((item, index) => <p key={item.id ?? index} className="py-1">{item.equipment?.name ?? item.equipmentId} · {item.hours ?? '—'} h</p>) : <p className="text-slate-400">Sin maquinaria.</p>}
                    </CardContent></Card>
                  </div>
                  {detail.observations && <Card><CardHeader><CardTitle className="text-sm">Observaciones</CardTitle></CardHeader><CardContent>{detail.observations}</CardContent></Card>}
                  {detail.approvals && detail.approvals.length > 0 && (
                    <Card><CardHeader><CardTitle className="text-sm">Aprobaciones</CardTitle></CardHeader><CardContent>
                      {detail.approvals.map((approval: ReportApproval) => <p key={approval.id} className="py-1">{label(approval.decision)} · {formatDateTime(approval.decidedAt)} · {approval.comments ?? 'Sin comentarios'}</p>)}
                    </CardContent></Card>
                  )}
                </div>
              )}

              {detailTab === 'adjuntos' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
                    <Paperclip className="h-5 w-5 text-amber-600" />
                    <p className="flex-1 text-sm text-slate-600">Adjunte documentos o fotografías del parte.</p>
                    <input ref={fileRef} type="file" className="hidden" onChange={uploadFile} />
                    <Button size="sm" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
                      <Upload className="h-4 w-4" /> {uploading ? 'Subiendo…' : 'Seleccionar archivo'}
                    </Button>
                  </div>
                  {attachments.length === 0 && <p className="py-4 text-center text-sm text-slate-400">No hay archivos adjuntos.</p>}
                  {attachments.map((attachment) => (
                    <div key={attachment.id} className="flex items-center gap-3 rounded-lg border border-slate-100 p-3">
                      <FileText className="h-5 w-5 text-slate-400" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{attachment.fileName}</p>
                        <p className="text-xs text-slate-400">{Math.round(attachment.sizeBytes / 1024)} KB · {formatDateTime(attachment.createdAt)}</p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => void downloadAttachment(attachment)} aria-label="Descargar"><Download className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-red-500" onClick={() => setDeletingAttachment(attachment)} aria-label="Eliminar adjunto"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>
              )}

              {detailTab === 'revisiones' && (
                <div className="max-h-96 space-y-2 overflow-y-auto">
                  {revisions.length === 0 && <p className="py-4 text-center text-sm text-slate-400">No hay revisiones registradas.</p>}
                  {revisions.map((revision) => (
                    <div key={revision.id} className="rounded-lg border border-slate-100 p-3">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline">Versión {revision.version}</Badge>
                        <span className="text-xs text-slate-400">{formatDateTime(revision.changedAt)}</span>
                      </div>
                      {revision.reason && <p className="mt-2 text-sm text-slate-600">{revision.reason}</p>}
                      <pre className="mt-2 max-h-32 overflow-auto rounded bg-slate-50 p-2 text-[10px] text-slate-500">{JSON.stringify(revision.snapshot, null, 2)}</pre>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
                {detail.status === 'DRAFT' && can('reports.submit') && <Button size="sm" onClick={() => setAction({ report: detail, kind: 'submit' })}><Send className="h-4 w-4" /> Enviar</Button>}
                {detail.status === 'SUBMITTED' && can('reports.review') && <Button size="sm" variant="secondary" onClick={() => setAction({ report: detail, kind: 'review' })}><ClipboardCheck className="h-4 w-4" /> Revisar</Button>}
                {detail.status === 'UNDER_REVIEW' && can('reports.approve') && (
                  <>
                    <Button size="sm" variant="destructive" onClick={() => setAction({ report: detail, kind: 'reject' })}><XCircle className="h-4 w-4" /> Rechazar</Button>
                    <Button size="sm" className="bg-emerald-700 hover:bg-emerald-800" onClick={() => setAction({ report: detail, kind: 'approve' })}><CheckCircle2 className="h-4 w-4" /> Aprobar</Button>
                  </>
                )}
                <Button size="sm" variant="outline" onClick={() => void api.download(`/reports/${detail.id}/export/csv`, undefined, `parte-${detail.code}.csv`)}><Download className="h-4 w-4" /> Exportar CSV</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deletingAttachment} onOpenChange={(open) => !open && setDeletingAttachment(null)} title="Eliminar adjunto" description={`¿Eliminar el archivo “${deletingAttachment?.fileName ?? ''}”?`} onConfirm={removeAttachment} />
    </div>
  );
}
