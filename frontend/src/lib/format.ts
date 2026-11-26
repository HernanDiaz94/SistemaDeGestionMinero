const ESTADO_LABELS: Record<string, string> = {
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
  SUSPENDED: 'Suspendido',
  TERMINATED: 'Retirado',
  PLANNED: 'Planificado',
  COMPLETED: 'Completado',
  CLOSED: 'Cerrado',
  TRIAL: 'Prueba',
  CANCELLED: 'Cancelado',
  PAST_DUE: 'Vencido',
  OPEN_PIT: 'Cielo abierto',
  UNDERGROUND: 'Subterráneo',
  DRAFT: 'Borrador',
  SUBMITTED: 'Enviado',
  UNDER_REVIEW: 'En revisión',
  APPROVED: 'Aprobado',
  REJECTED: 'Rechazado',
  OPERATIONAL: 'Operativo',
  MAINTENANCE: 'Mantenimiento',
  OUT_OF_SERVICE: 'Fuera de servicio',
  EMPLOYEE: 'Empleado',
  CONTRACTOR: 'Contratista',
  DAY: 'Día',
  NIGHT: 'Noche',
  ROTATING: 'Rotativo',
  MASS: 'Masa',
  VOLUME: 'Volumen',
  LENGTH: 'Longitud',
  TIME: 'Tiempo',
  COUNT: 'Cantidad',
  DAILY: 'Diario',
  WEEKLY: 'Semanal',
  MONTHLY: 'Mensual',
  SUPERADMIN: 'Superadministrador',
  ADMIN: 'Administrador',
  USER: 'Usuario',
  BENCH: 'Banco',
  PHASE: 'Fase',
  EXTRACTION_FRONT: 'Frente de extracción',
  HAUL_ROAD: 'Vía de acarreo',
  LEVEL: 'Nivel',
  DRIFT: 'Galería',
  RAMP: 'Rampa',
  ADVANCE_FRONT: 'Frente de avance',
  OTHER: 'Otro',
  CREATE: 'Crear',
  UPDATE: 'Actualizar',
  DELETE: 'Eliminar',
  SUBMIT: 'Enviar',
  APPROVE: 'Aprobar',
  LOGIN: 'Inicio de sesión',
  LOGOUT: 'Cierre de sesión',
  SWITCH_TENANT: 'Cambio de empresa',
};

export function label(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  const s = String(value);
  return ESTADO_LABELS[s] ?? s.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());
}

export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'purple';

export function statusTone(value: unknown): BadgeTone {
  switch (String(value)) {
    case 'ACTIVE':
    case 'OPERATIONAL':
    case 'APPROVED':
    case 'COMPLETED':
      return 'success';
    case 'PLANNED':
    case 'SUBMITTED':
    case 'TRIAL':
    case 'DRAFT':
      return 'info';
    case 'UNDER_REVIEW':
    case 'MAINTENANCE':
    case 'SUSPENDED':
    case 'ROTATING':
      return 'warning';
    case 'REJECTED':
    case 'INACTIVE':
    case 'OUT_OF_SERVICE':
    case 'TERMINATED':
    case 'CANCELLED':
    case 'PAST_DUE':
    case 'CLOSED':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function formatDate(value: unknown): string {
  if (!value) return '—';
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}

export function formatDateTime(value: unknown): string {
  if (!value) return '—';
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatNumber(value: unknown, decimals = 2): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('es-CL', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

export function formatMoney(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(n);
}

export function initials(first?: string | null, last?: string | null): string {
  return `${(first ?? '').charAt(0)}${(last ?? '').charAt(0)}`.toUpperCase() || 'MM';
}
