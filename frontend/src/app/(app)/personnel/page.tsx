'use client';

import { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { PageHeader } from '@/components/shared/page-header';
import { ResourceTable, StatusCell, type Column } from '@/components/shared/resource-table';
import { FormModal, field, type FormField, type FormValues } from '@/components/shared/form-modal';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { useApiList } from '@/hooks/use-api';
import { api, type Crew, type Employee, type Project, type Shift } from '@/lib/api';
import { formatDate, label } from '@/lib/format';

type Entity = 'employees' | 'crews' | 'shifts';
interface ModalState { entity: Entity; item: Employee | Crew | Shift | null }
interface DeleteState { entity: Entity; id: string; name: string }

const EMPLOYEE_STATUS = ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'TERMINATED'].map((value) => ({ value, label: label(value) }));
const EMPLOYEE_TYPES = ['EMPLOYEE', 'CONTRACTOR'].map((value) => ({ value, label: label(value) }));
const SHIFT_TYPES = ['DAY', 'NIGHT', 'ROTATING'].map((value) => ({ value, label: label(value) }));

export default function PersonnelPage() {
  const { success, error: toastError } = useToast();
  const [tab, setTab] = useState<Entity>('employees');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [projectId, setProjectId] = useState('');
  const [modal, setModal] = useState<ModalState | null>(null);
  const [deleting, setDeleting] = useState<DeleteState | null>(null);

  const projects = useApiList<Project>('/projects');
  const employees = useApiList<Employee>('/employees');
  const crews = useApiList<Crew>('/crews');
  const shifts = useApiList<Shift>('/shifts');

  const sources = { employees, crews, shifts };

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('q');
    if (q) setSearch(q);
  }, []);

  const filteredEmployees = employees.data.filter((row) => {
    const term = search.trim().toLowerCase();
    return (!term || `${row.code} ${row.firstName} ${row.lastName} ${row.documentNumber} ${row.position}`.toLowerCase().includes(term)) &&
      (!status || row.status === status) && (!type || row.type === type) && (!projectId || row.projectId === projectId);
  });
  const filteredCrews = crews.data.filter((row) => {
    const term = search.trim().toLowerCase();
    return (!term || `${row.code} ${row.name}`.toLowerCase().includes(term)) &&
      (!status || row.status === status) && (!projectId || row.projectId === projectId);
  });
  const filteredShifts = shifts.data.filter((row) => {
    const term = search.trim().toLowerCase();
    return (!term || `${row.code} ${row.name}`.toLowerCase().includes(term)) && (!status || row.status === status);
  });

  function fieldsFor(entity: Entity): FormField[] {
    const projectOptions = projects.data.map((p) => ({ value: p.id, label: p.name }));
    if (entity === 'employees') return [
      field('code', 'Código', { required: true, placeholder: 'EMP-001' }),
      field('firstName', 'Nombre', { required: true }),
      field('lastName', 'Apellido', { required: true }),
      field('documentType', 'Tipo de documento', { type: 'select', options: [{ value: 'DNI', label: 'DNI' }, { value: 'RUT', label: 'RUT' }, { value: 'Pasaporte', label: 'Pasaporte' }] }),
      field('documentNumber', 'Número de documento', { required: true }),
      field('position', 'Cargo', { required: true, placeholder: 'Operador de minería' }),
      field('projectId', 'Proyecto', { type: 'select', options: projectOptions }),
      field('crewId', 'Cuadrilla', { type: 'select', options: crews.data.map((c) => ({ value: c.id, label: c.name })) }),
      field('shiftId', 'Turno', { type: 'select', options: shifts.data.map((s) => ({ value: s.id, label: s.name })) }),
      field('type', 'Tipo', { type: 'select', options: EMPLOYEE_TYPES }),
      field('status', 'Estado', { type: 'select', options: EMPLOYEE_STATUS }),
      field('email', 'Correo electrónico', { type: 'email' }),
      field('phone', 'Teléfono'),
      field('company', 'Empresa contratista'),
      field('hiredAt', 'Fecha de ingreso', { type: 'date' }),
    ];
    if (entity === 'crews') return [
      field('code', 'Código', { required: true, placeholder: 'TRU-001' }),
      field('name', 'Nombre', { required: true }),
      field('projectId', 'Proyecto', { type: 'select', required: true, options: projectOptions }),
      field('shiftId', 'Turno', { type: 'select', options: shifts.data.map((s) => ({ value: s.id, label: s.name })) }),
      field('supervisorId', 'Supervisor', { type: 'select', options: employees.data.map((e) => ({ value: e.id, label: `${e.firstName} ${e.lastName}` })) }),
      field('status', 'Estado', { type: 'select', options: EMPLOYEE_STATUS }),
    ];
    return [
      field('code', 'Código', { required: true, placeholder: 'TUR-DIA' }),
      field('name', 'Nombre', { required: true, placeholder: 'Turno día' }),
      field('type', 'Tipo', { type: 'select', required: true, options: SHIFT_TYPES }),
      field('startTime', 'Hora de inicio', { type: 'time', required: true, placeholder: '08:00' }),
      field('endTime', 'Hora de término', { type: 'time', required: true, placeholder: '20:00' }),
      field('projectId', 'Proyecto', { type: 'select', options: projectOptions }),
      field('status', 'Estado', { type: 'select', options: EMPLOYEE_STATUS }),
    ];
  }

  async function save(values: FormValues) {
    if (!modal) return;
    const { entity, item } = modal;
    let payload: Record<string, unknown> = {};
    if (entity === 'employees') payload = {
      code: String(values.code).trim(),
      firstName: String(values.firstName).trim(),
      lastName: String(values.lastName).trim(),
      documentType: values.documentType ? String(values.documentType) : 'DNI',
      documentNumber: String(values.documentNumber).trim(),
      position: String(values.position).trim(),
      projectId: values.projectId || null,
      crewId: values.crewId || null,
      shiftId: values.shiftId || null,
      type: values.type || 'EMPLOYEE',
      status: values.status || 'ACTIVE',
      email: values.email || null,
      phone: values.phone || null,
      company: values.company || null,
      hiredAt: values.hiredAt || null,
    };
    if (entity === 'crews') payload = {
      code: String(values.code).trim(),
      name: String(values.name).trim(),
      projectId: String(values.projectId),
      shiftId: values.shiftId || null,
      supervisorId: values.supervisorId || null,
      status: values.status || 'ACTIVE',
    };
    if (entity === 'shifts') payload = {
      code: String(values.code).trim(),
      name: String(values.name).trim(),
      type: values.type || 'DAY',
      startTime: String(values.startTime).slice(0, 5),
      endTime: String(values.endTime).slice(0, 5),
      projectId: values.projectId || null,
      status: values.status || 'ACTIVE',
    };
    const path = `/${entity}${item ? `/${item.id}` : ''}`;
    if (item) await api.patch(path, payload);
    else await api.post(path, payload);
    success(item ? 'Registro actualizado' : 'Registro creado', String(values.name ?? `${values.firstName ?? ''} ${values.lastName ?? ''}`));
    setModal(null);
    sources[entity].reload();
  }

  async function remove() {
    if (!deleting) return;
    try {
      await api.delete(`/${deleting.entity}/${deleting.id}`);
      success('Registro eliminado', deleting.name);
      sources[deleting.entity].reload();
    } catch (err) {
      toastError('No se pudo eliminar el registro', err instanceof Error ? err.message : undefined);
      throw err;
    }
  }

  const employeeColumns: Array<Column<Employee>> = [
    { key: 'code', header: 'Código', render: (row) => <span className="font-mono text-xs font-semibold text-amber-700">{row.code}</span> },
    { key: 'name', header: 'Empleado', render: (row) => <div><p className="font-semibold">{row.firstName} {row.lastName}</p><p className="text-xs text-slate-400">{row.documentType} {row.documentNumber}</p></div> },
    { key: 'position', header: 'Cargo', render: (row) => row.position },
    { key: 'type', header: 'Tipo', render: (row) => label(row.type) },
    { key: 'project', header: 'Proyecto', render: (row) => projects.data.find((p) => p.id === row.projectId)?.name ?? '—' },
    { key: 'hired', header: 'Ingreso', render: (row) => formatDate(row.hiredAt) },
    { key: 'status', header: 'Estado', render: (row) => <StatusCell value={row.status} /> },
    { key: 'actions', header: 'Acciones', render: (row) => <Actions onEdit={() => setModal({ entity: 'employees', item: row })} onDelete={() => setDeleting({ entity: 'employees', id: row.id, name: `${row.firstName} ${row.lastName}` })} /> },
  ];

  const crewColumns: Array<Column<Crew>> = [
    { key: 'code', header: 'Código', render: (row) => <span className="font-mono text-xs font-semibold text-amber-700">{row.code}</span> },
    { key: 'name', header: 'Cuadrilla', render: (row) => <span className="font-semibold">{row.name}</span> },
    { key: 'project', header: 'Proyecto', render: (row) => projects.data.find((p) => p.id === row.projectId)?.name ?? '—' },
    { key: 'shift', header: 'Turno', render: (row) => shifts.data.find((s) => s.id === row.shiftId)?.name ?? '—' },
    { key: 'supervisor', header: 'Supervisor', render: (row) => {
      const found = employees.data.find((e) => e.id === row.supervisorId);
      return found ? `${found.firstName} ${found.lastName}` : '—';
    } },
    { key: 'status', header: 'Estado', render: (row) => <StatusCell value={row.status} /> },
    { key: 'actions', header: 'Acciones', render: (row) => <Actions onEdit={() => setModal({ entity: 'crews', item: row })} onDelete={() => setDeleting({ entity: 'crews', id: row.id, name: row.name })} /> },
  ];

  const shiftColumns: Array<Column<Shift>> = [
    { key: 'code', header: 'Código', render: (row) => <span className="font-mono text-xs font-semibold text-amber-700">{row.code}</span> },
    { key: 'name', header: 'Turno', render: (row) => <span className="font-semibold">{row.name}</span> },
    { key: 'type', header: 'Tipo', render: (row) => label(row.type) },
    { key: 'hours', header: 'Horario', render: (row) => `${row.startTime} – ${row.endTime}` },
    { key: 'status', header: 'Estado', render: (row) => <StatusCell value={row.status} /> },
    { key: 'actions', header: 'Acciones', render: (row) => <Actions onEdit={() => setModal({ entity: 'shifts', item: row })} onDelete={() => setDeleting({ entity: 'shifts', id: row.id, name: row.name })} /> },
  ];

  const tabs: Array<{ id: Entity; label: string }> = [
    { id: 'employees', label: 'Empleados' },
    { id: 'crews', label: 'Cuadrillas' },
    { id: 'shifts', label: 'Turnos' },
  ];

  const commonFilters = [
    { key: 'status', label: 'Estado', value: status, options: EMPLOYEE_STATUS, onChange: setStatus },
    ...(tab !== 'shifts' ? [{ key: 'project', label: 'Proyecto', value: projectId, options: projects.data.map((p) => ({ value: p.id, label: p.name })), onChange: setProjectId }] : []),
    ...(tab === 'employees' ? [{ key: 'type', label: 'Tipo', value: type, options: EMPLOYEE_TYPES, onChange: setType }] : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Personal"
        description="Administración de empleados, cuadrillas y turnos de la operación."
        actions={<Button onClick={() => setModal({ entity: tab, item: null })}><Plus className="h-4 w-4" /> Nuevo registro</Button>}
      />

      <Card><CardContent className="p-4"><p className="text-sm text-slate-500">
        {tab === 'employees' ? `${employees.data.length} empleados registrados` : tab === 'crews' ? `${crews.data.length} cuadrillas registradas` : `${shifts.data.length} turnos registrados`}
      </p></CardContent></Card>

      <div className="flex gap-1 border-b border-slate-200">
        {tabs.map((item) => (
          <button key={item.id} type="button" onClick={() => { setTab(item.id); setSearch(''); }} className={`border-b-2 px-4 py-2.5 text-sm font-semibold ${tab === item.id ? 'border-amber-500 text-amber-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'employees' && <ResourceTable data={filteredEmployees} columns={employeeColumns} loading={employees.loading} error={employees.error} onRetry={employees.reload} search={search} onSearchChange={setSearch} searchPlaceholder="Buscar empleados…" filters={commonFilters} getRowKey={(row) => row.id} emptyTitle="No hay empleados" emptyDescription="Registre el personal de la operación." />}
      {tab === 'crews' && <ResourceTable data={filteredCrews} columns={crewColumns} loading={crews.loading} error={crews.error} onRetry={crews.reload} search={search} onSearchChange={setSearch} searchPlaceholder="Buscar cuadrillas…" filters={commonFilters} getRowKey={(row) => row.id} emptyTitle="No hay cuadrillas" emptyDescription="Cree una cuadrilla de trabajo." />}
      {tab === 'shifts' && <ResourceTable data={filteredShifts} columns={shiftColumns} loading={shifts.loading} error={shifts.error} onRetry={shifts.reload} search={search} onSearchChange={setSearch} searchPlaceholder="Buscar turnos…" filters={commonFilters} getRowKey={(row) => row.id} emptyTitle="No hay turnos" emptyDescription="Defina los turnos de trabajo." />}

      <FormModal
        open={!!modal}
        onOpenChange={(open) => !open && setModal(null)}
        title={modal ? `${modal.item ? 'Editar' : 'Nuevo'} ${modal.entity === 'employees' ? 'empleado' : modal.entity === 'crews' ? 'cuadrilla' : 'turno'}` : ''}
        initialValues={modal?.item ?? (modal?.entity === 'employees' ? { documentType: 'DNI', type: 'EMPLOYEE', status: 'ACTIVE' } : { status: 'ACTIVE' })}
        fields={modal ? fieldsFor(modal.entity) : []}
        onSubmit={save}
        submitLabel="Guardar"
        wide={modal?.entity === 'employees'}
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
