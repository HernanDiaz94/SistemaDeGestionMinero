'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useApiList } from '@/hooks/use-api';
import { useAuth } from '@/lib/auth';
import { api, type Area, type Employee, type Equipment, type Mine, type ProductionIndicator, type ProductionUnit, type Project, type Shift } from '@/lib/api';
import { todayInput } from '@/lib/utils';

const STEPS = ['Datos generales', 'Actividades', 'Producción', 'Personal', 'Maquinaria', 'Observaciones'];

interface ActivityRow { areaId: string; description: string; startAt: string; endAt: string; hours: string; notes: string }
interface ProductionRow { indicatorId: string; unitId: string; value: string; notes: string }
interface EmployeeRow { employeeId: string; hours: string; role: string; notes: string }
interface EquipmentRow { equipmentId: string; hours: string; fuelLiters: string; notes: string }

const emptyActivity = (): ActivityRow => ({ areaId: '', description: '', startAt: '', endAt: '', hours: '', notes: '' });
const emptyProduction = (): ProductionRow => ({ indicatorId: '', unitId: '', value: '', notes: '' });
const emptyEmployee = (): EmployeeRow => ({ employeeId: '', hours: '', role: '', notes: '' });
const emptyEquipment = (): EquipmentRow => ({ equipmentId: '', hours: '', fuelLiters: '', notes: '' });

interface ReportWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}{required && <span className="ml-0.5 text-red-500">*</span>}</Label>
      {children}
    </div>
  );
}

export function ReportWizard({ open, onOpenChange, onSaved }: ReportWizardProps) {
  const { user } = useAuth();
  const projects = useApiList<Project>(open ? '/projects' : null);
  const mines = useApiList<Mine>(open ? '/mines' : null);
  const shifts = useApiList<Shift>(open ? '/shifts' : null);
  const employees = useApiList<Employee>(open ? '/employees' : null);
  const equipment = useApiList<Equipment>(open ? '/equipment' : null);
  const indicators = useApiList<ProductionIndicator>(open ? '/production/indicators' : null);
  const units = useApiList<ProductionUnit>(open ? '/production/units' : null);

  const [step, setStep] = useState(0);
  const [projectId, setProjectId] = useState('');
  const [mineId, setMineId] = useState('');
  const [areaId, setAreaId] = useState('');
  const [shiftId, setShiftId] = useState('');
  const [date, setDate] = useState(todayInput());
  const [code, setCode] = useState('');
  const [observations, setObservations] = useState('');
  const [activities, setActivities] = useState<ActivityRow[]>([emptyActivity()]);
  const [production, setProduction] = useState<ProductionRow[]>([]);
  const [personal, setPersonal] = useState<EmployeeRow[]>([]);
  const [maquinaria, setMaquinaria] = useState<EquipmentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const areas = useApiList<Area>(open && mineId ? '/areas' : null, { mineId });

  const mineOptions = useMemo(() => mines.data.filter((mine) => !projectId || mine.projectId === projectId), [mines.data, projectId]);

  function updateRow<T>(setter: (rows: T[]) => void, rows: T[], index: number, patch: Partial<T>) {
    setter(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function validateStep(): string | null {
    if (step === 0 && (!projectId || !mineId || !shiftId || !date)) return 'Complete proyecto, yacimiento, turno y fecha.';
    if (step === 1 && activities.some((row) => !row.description.trim())) return 'Todas las actividades requieren una descripción.';
    if (step === 2 && production.some((row) => !row.indicatorId || !row.unitId || row.value === '' || Number(row.value) < 0)) return 'Revise indicador, unidad y valor de cada registro de producción.';
    if (step === 3 && personal.some((row) => !row.employeeId)) return 'Seleccione un empleado en cada fila de personal.';
    if (step === 4 && maquinaria.some((row) => !row.equipmentId)) return 'Seleccione una maquinaria en cada fila.';
    return null;
  }

  function next() {
    const problem = validateStep();
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setStep((current) => Math.min(STEPS.length - 1, current + 1));
  }

  async function finish() {
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/reports', {
        projectId,
        mineId,
        areaId: areaId || undefined,
        shiftId,
        date,
        code: code || undefined,
        supervisorUserId: user?.id || undefined,
        observations: observations || undefined,
        activities: activities.filter((row) => row.description.trim()).map((row) => ({
          ...(row.areaId ? { areaId: row.areaId } : {}),
          description: row.description.trim(),
          ...(row.startAt ? { startAt: new Date(row.startAt).toISOString() } : {}),
          ...(row.endAt ? { endAt: new Date(row.endAt).toISOString() } : {}),
          ...(row.hours ? { hours: Number(row.hours) } : {}),
          ...(row.notes ? { notes: row.notes } : {}),
        })),
        production: production.map((row) => ({
          indicatorId: row.indicatorId,
          unitId: row.unitId,
          value: Number(row.value),
          ...(row.notes ? { notes: row.notes } : {}),
        })),
        employees: personal.map((row) => ({
          employeeId: row.employeeId,
          ...(row.hours ? { hours: Number(row.hours) } : {}),
          ...(row.role ? { role: row.role } : {}),
          ...(row.notes ? { notes: row.notes } : {}),
        })),
        equipment: maquinaria.map((row) => ({
          equipmentId: row.equipmentId,
          ...(row.hours ? { hours: Number(row.hours) } : {}),
          ...(row.fuelLiters ? { fuelLiters: Number(row.fuelLiters) } : {}),
          ...(row.notes ? { notes: row.notes } : {}),
        })),
      });
      onSaved();
      onOpenChange(false);
      setStep(0);
      setActivities([emptyActivity()]);
      setProduction([]);
      setPersonal([]);
      setMaquinaria([]);
      setObservations('');
      setCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el parte');
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = 'h-9';

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!submitting) onOpenChange(value); }}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Nuevo parte de operación</DialogTitle>
          <DialogDescription>Complete las seis secciones y guarde el parte en el sistema.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-1.5 border-b border-slate-100 pb-3">
          {STEPS.map((label, index) => (
            <button
              key={label}
              type="button"
              onClick={() => { if (index < step) setStep(index); }}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${index === step ? 'bg-emerald-900 text-white' : index < step ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}
            >
              {index + 1}. {label}
            </button>
          ))}
        </div>

        <div className="min-h-64 space-y-4">
          {step === 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Proyecto" required>
                <Select className={inputClass} value={projectId} onChange={(event) => { setProjectId(event.target.value); setMineId(''); setAreaId(''); }} placeholder="Seleccione proyecto" options={projects.data.map((p) => ({ value: p.id, label: p.name }))} />
              </Field>
              <Field label="Yacimiento" required>
                <Select className={inputClass} value={mineId} onChange={(event) => { setMineId(event.target.value); setAreaId(''); }} placeholder="Seleccione yacimiento" options={mineOptions.map((m) => ({ value: m.id, label: m.name }))} />
              </Field>
              <Field label="Sector">
                <Select className={inputClass} value={areaId} onChange={(event) => setAreaId(event.target.value)} placeholder="Sin sector" options={areas.data.map((a) => ({ value: a.id, label: a.name }))} />
              </Field>
              <Field label="Turno" required>
                <Select className={inputClass} value={shiftId} onChange={(event) => setShiftId(event.target.value)} placeholder="Seleccione turno" options={shifts.data.map((s) => ({ value: s.id, label: `${s.name} (${s.startTime}–${s.endTime})` }))} />
              </Field>
              <Field label="Fecha" required>
                <Input type="date" className={inputClass} value={date} onChange={(event) => setDate(event.target.value)} />
              </Field>
              <Field label="Código (opcional)">
                <Input className={inputClass} value={code} onChange={(event) => setCode(event.target.value)} placeholder="Generado automáticamente" />
              </Field>
              {(projects.error || mines.error || shifts.error) && <p className="text-sm text-red-600 sm:col-span-2">{projects.error || mines.error || shifts.error}</p>}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              {activities.map((row, index) => (
                <div key={index} className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="sm:col-span-2"><Field label="Descripción" required><Input className={inputClass} value={row.description} onChange={(event) => updateRow(setActivities, activities, index, { description: event.target.value })} placeholder="Actividad realizada" /></Field></div>
                  <Field label="Sector"><Select className={inputClass} value={row.areaId} onChange={(event) => updateRow(setActivities, activities, index, { areaId: event.target.value })} placeholder="Sin sector" options={areas.data.map((a) => ({ value: a.id, label: a.name }))} /></Field>
                  <Field label="Horas"><Input type="number" min="0" step="0.25" className={inputClass} value={row.hours} onChange={(event) => updateRow(setActivities, activities, index, { hours: event.target.value })} /></Field>
                  <Field label="Inicio"><Input type="datetime-local" className={inputClass} value={row.startAt} onChange={(event) => updateRow(setActivities, activities, index, { startAt: event.target.value })} /></Field>
                  <Field label="Término"><Input type="datetime-local" className={inputClass} value={row.endAt} onChange={(event) => updateRow(setActivities, activities, index, { endAt: event.target.value })} /></Field>
                  <div className="lg:col-span-2"><Field label="Notas"><Input className={inputClass} value={row.notes} onChange={(event) => updateRow(setActivities, activities, index, { notes: event.target.value })} /></Field></div>
                  {activities.length > 1 && <Button variant="ghost" size="icon" className="self-end text-red-500" onClick={() => setActivities(activities.filter((_, i) => i !== index))} aria-label="Quitar actividad"><Trash2 className="h-4 w-4" /></Button>}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setActivities([...activities, emptyActivity()])}><Plus className="h-4 w-4" /> Agregar actividad</Button>
              {areas.error && <p className="text-sm text-red-600">{areas.error}</p>}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              {production.length === 0 && <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Sin registros de producción. Puede continuar o agregar uno.</p>}
              {production.map((row, index) => {
                const selected = indicators.data.find((i) => i.id === row.indicatorId);
                const compatibleUnits = units.data.filter((u) => !selected || u.category === selected.category);
                return (
                  <div key={index} className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Field label="Indicador" required><Select className={inputClass} value={row.indicatorId} onChange={(event) => updateRow(setProduction, production, index, { indicatorId: event.target.value, unitId: '' })} placeholder="Seleccione" options={indicators.data.map((i) => ({ value: i.id, label: i.name }))} /></Field>
                    <Field label="Unidad" required><Select className={inputClass} value={row.unitId} onChange={(event) => updateRow(setProduction, production, index, { unitId: event.target.value })} placeholder="Seleccione" options={compatibleUnits.map((u) => ({ value: u.id, label: `${u.name} (${u.symbol})` }))} /></Field>
                    <Field label="Valor" required><Input type="number" step="0.001" className={inputClass} value={row.value} onChange={(event) => updateRow(setProduction, production, index, { value: event.target.value })} /></Field>
                    <Field label="Notas"><Input className={inputClass} value={row.notes} onChange={(event) => updateRow(setProduction, production, index, { notes: event.target.value })} /></Field>
                    <Button variant="ghost" size="sm" className="text-red-500 lg:col-span-4 justify-self-end" onClick={() => setProduction(production.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /> Quitar</Button>
                  </div>
                );
              })}
              <Button variant="outline" size="sm" onClick={() => setProduction([...production, emptyProduction()])}><Plus className="h-4 w-4" /> Agregar producción</Button>
              {(indicators.error || units.error) && <p className="text-sm text-red-600">{indicators.error || units.error}</p>}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              {personal.length === 0 && <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Sin personal asignado al parte.</p>}
              {personal.map((row, index) => (
                <div key={index} className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="lg:col-span-2"><Field label="Empleado" required><Select className={inputClass} value={row.employeeId} onChange={(event) => updateRow(setPersonal, personal, index, { employeeId: event.target.value })} placeholder="Seleccione" options={employees.data.map((e) => ({ value: e.id, label: `${e.firstName} ${e.lastName} · ${e.code}` }))} /></Field></div>
                  <Field label="Horas"><Input type="number" min="0" step="0.25" className={inputClass} value={row.hours} onChange={(event) => updateRow(setPersonal, personal, index, { hours: event.target.value })} /></Field>
                  <Field label="Rol"><Input className={inputClass} value={row.role} onChange={(event) => updateRow(setPersonal, personal, index, { role: event.target.value })} placeholder="Ej. Operador" /></Field>
                  <div className="lg:col-span-3"><Field label="Notas"><Input className={inputClass} value={row.notes} onChange={(event) => updateRow(setPersonal, personal, index, { notes: event.target.value })} /></Field></div>
                  <Button variant="ghost" size="sm" className="text-red-500" onClick={() => setPersonal(personal.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /> Quitar</Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setPersonal([...personal, emptyEmployee()])}><Plus className="h-4 w-4" /> Agregar personal</Button>
              {employees.error && <p className="text-sm text-red-600">{employees.error}</p>}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              {maquinaria.length === 0 && <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Sin maquinaria asignada al parte.</p>}
              {maquinaria.map((row, index) => (
                <div key={index} className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="lg:col-span-2"><Field label="Equipo" required><Select className={inputClass} value={row.equipmentId} onChange={(event) => updateRow(setMaquinaria, maquinaria, index, { equipmentId: event.target.value })} placeholder="Seleccione" options={equipment.data.map((e) => ({ value: e.id, label: `${e.name} · ${e.code}` }))} /></Field></div>
                  <Field label="Horas"><Input type="number" min="0" step="0.25" className={inputClass} value={row.hours} onChange={(event) => updateRow(setMaquinaria, maquinaria, index, { hours: event.target.value })} /></Field>
                  <Field label="Combustible (L)"><Input type="number" min="0" step="0.001" className={inputClass} value={row.fuelLiters} onChange={(event) => updateRow(setMaquinaria, maquinaria, index, { fuelLiters: event.target.value })} /></Field>
                  <div className="lg:col-span-3"><Field label="Notas"><Input className={inputClass} value={row.notes} onChange={(event) => updateRow(setMaquinaria, maquinaria, index, { notes: event.target.value })} /></Field></div>
                  <Button variant="ghost" size="sm" className="text-red-500" onClick={() => setMaquinaria(maquinaria.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /> Quitar</Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setMaquinaria([...maquinaria, emptyEquipment()])}><Plus className="h-4 w-4" /> Agregar maquinaria</Button>
              {equipment.error && <p className="text-sm text-red-600">{equipment.error}</p>}
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <Field label="Observaciones generales">
                <Textarea rows={7} value={observations} onChange={(event) => setObservations(event.target.value)} placeholder="Condiciones de la operación, incidencias, recomendaciones…" />
              </Field>
              <div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">
                <p className="font-semibold">Resumen del parte</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="outline">{activities.filter((a) => a.description).length} actividades</Badge>
                  <Badge variant="outline">{production.length} producciones</Badge>
                  <Badge variant="outline">{personal.length} personas</Badge>
                  <Badge variant="outline">{maquinaria.length} equipos</Badge>
                </div>
              </div>
            </div>
          )}

          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <Button variant="outline" onClick={() => { setError(null); step === 0 ? onOpenChange(false) : setStep(step - 1); }} disabled={submitting}>
            {step === 0 ? 'Cancelar' : <><ArrowLeft className="h-4 w-4" /> Anterior</>}
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={next}>Siguiente <ArrowRight className="h-4 w-4" /></Button>
          ) : (
            <Button onClick={finish} disabled={submitting}>{submitting && <Loader2 className="h-4 w-4 animate-spin" />} Guardar parte</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
