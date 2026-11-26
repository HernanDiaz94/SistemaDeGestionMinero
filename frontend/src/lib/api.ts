/* Cliente HTTP tipado para la API de Mining Manager. */

export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace(/\/$/, '');
const ACCESS_KEY = 'mm_access_token';
const REFRESH_KEY = 'mm_refresh_token';
export const TOKENS_EVENT = 'mm:auth-tokens';
export const LOGOUT_EVENT = 'mm:auth-logout';

export type GlobalRole = 'SUPERADMIN' | 'ADMIN' | 'USER';
export type TenantStatus = 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
export type ProjectStatus = 'PLANNED' | 'ACTIVE' | 'SUSPENDED' | 'COMPLETED';
export type MineMode = 'OPEN_PIT' | 'UNDERGROUND';
export type MineStatus = 'PLANNED' | 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
export type ReportStatus = 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';
export type EquipmentStatus = 'OPERATIONAL' | 'MAINTENANCE' | 'OUT_OF_SERVICE' | 'INACTIVE';

export interface AuthUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  globalRole: GlobalRole;
  tenantId?: string | null;
  tenantName?: string | null;
  tenantSlug?: string | null;
  timezone?: string;
  permissions: string[];
  roles?: Array<{ key: string; name: string }>;
  status?: string;
}

export interface TenantSummary {
  id: string;
  name: string;
  slug: string;
  status?: TenantStatus;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  tenants: TenantSummary[];
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

export interface MeResponse {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  globalRole: GlobalRole;
  status?: string;
  tenant: TenantSummary | null;
  roles?: Array<{ key: string; name: string }>;
  permissions: string[];
  tenants: TenantSummary[];
  timezone?: string;
}

export interface Project {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  status: ProjectStatus;
  startDate?: string | null;
  endDate?: string | null;
  managerId?: string | null;
  createdAt?: string;
  mines?: Mine[];
  [key: string]: unknown;
}

export interface Mine {
  id: string;
  projectId: string;
  code: string;
  name: string;
  mode: MineMode;
  status: MineStatus;
  description?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  project?: Project;
  [key: string]: unknown;
}

export interface Area {
  id: string;
  mineId: string;
  parentId?: string | null;
  code: string;
  name: string;
  type: string;
  description?: string | null;
  status?: string;
  children?: Area[];
  [key: string]: unknown;
}

export interface Shift {
  id: string;
  code: string;
  name: string;
  type: string;
  startTime: string;
  endTime: string;
  projectId?: string | null;
  status?: string;
  [key: string]: unknown;
}

export interface Crew {
  id: string;
  code: string;
  name: string;
  projectId: string;
  shiftId?: string | null;
  supervisorId?: string | null;
  status?: string;
  [key: string]: unknown;
}

export interface Employee {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  documentType: string;
  documentNumber: string;
  email?: string | null;
  phone?: string | null;
  position: string;
  company?: string | null;
  type: string;
  status: string;
  projectId?: string | null;
  crewId?: string | null;
  shiftId?: string | null;
  hiredAt?: string | null;
  [key: string]: unknown;
}

export interface EquipmentCategory {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  [key: string]: unknown;
}

export interface Equipment {
  id: string;
  code: string;
  name: string;
  categoryId?: string | null;
  projectId?: string | null;
  responsibleId?: string | null;
  brand?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  status: EquipmentStatus;
  operatingHours?: number | string;
  purchaseDate?: string | null;
  notes?: string | null;
  category?: EquipmentCategory;
  project?: Project;
  [key: string]: unknown;
}

export interface ProductionUnit {
  id: string;
  code: string;
  name: string;
  symbol: string;
  category: string;
  factorToBaseUnit: number | string;
  active: boolean;
  [key: string]: unknown;
}

export interface ProductionIndicator {
  id: string;
  code: string;
  name: string;
  unitId: string;
  category: string;
  description?: string | null;
  active: boolean;
  unit?: ProductionUnit;
  [key: string]: unknown;
}

export interface ProductionTarget {
  id: string;
  projectId: string;
  mineId?: string | null;
  areaId?: string | null;
  indicatorId: string;
  period: string;
  year: number;
  month?: number | null;
  day?: number | null;
  targetValue: number | string;
  indicator?: ProductionIndicator;
  project?: Project;
  mine?: Mine;
  [key: string]: unknown;
}

export interface ProductionRecord {
  id: string;
  reportId?: string;
  indicatorId: string;
  unitId: string;
  value: number | string;
  notes?: string | null;
  recordedAt?: string;
  indicator?: ProductionIndicator;
  unit?: ProductionUnit;
  [key: string]: unknown;
}

export interface OperationActivity {
  id?: string;
  areaId?: string | null;
  description: string;
  startAt?: string | null;
  endAt?: string | null;
  hours?: number | string | null;
  notes?: string | null;
  [key: string]: unknown;
}

export interface ReportEmployeeEntry {
  id?: string;
  employeeId: string;
  employee?: Employee;
  hours?: number | string | null;
  role?: string | null;
  notes?: string | null;
  [key: string]: unknown;
}

export interface ReportEquipmentEntry {
  id?: string;
  equipmentId: string;
  equipment?: Equipment;
  hours?: number | string | null;
  fuelLiters?: number | string | null;
  notes?: string | null;
  [key: string]: unknown;
}

export interface OperationReport {
  id: string;
  code: string;
  date: string;
  status: ReportStatus;
  projectId: string;
  mineId: string;
  areaId?: string | null;
  shiftId: string;
  supervisorUserId?: string;
  supervisor?: { firstName?: string; lastName?: string; email?: string };
  supervisorEmployeeId?: string | null;
  responsibleTenantUserId?: string | null;
  observations?: string | null;
  version?: number;
  createdAt?: string;
  project?: Project;
  mine?: Mine;
  area?: Area;
  shift?: Shift;
  activities?: OperationActivity[];
  production?: ProductionRecord[];
  employees?: ReportEmployeeEntry[];
  equipment?: ReportEquipmentEntry[];
  attachments?: ReportAttachment[];
  approvals?: ReportApproval[];
  revisions?: ReportRevision[];
  [key: string]: unknown;
}

export interface ReportAttachment {
  id: string;
  fileName: string;
  kind: string;
  mimeType: string;
  sizeBytes: number;
  url?: string | null;
  createdAt?: string;
  [key: string]: unknown;
}

export interface ReportApproval {
  id: string;
  decision: string;
  comments?: string | null;
  decidedAt?: string;
  reviewer?: { firstName?: string; lastName?: string; email?: string };
  [key: string]: unknown;
}

export interface ReportRevision {
  id: string;
  version: number;
  snapshot: unknown;
  reason?: string | null;
  changedAt?: string;
  [key: string]: unknown;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  legalName?: string | null;
  taxId?: string | null;
  timezone?: string;
  status: TenantStatus;
  createdAt?: string;
  modules?: TenantModule[];
  subscriptions?: Subscription[];
  [key: string]: unknown;
}

export interface TenantModule {
  id?: string;
  key: string;
  enabled: boolean;
  [key: string]: unknown;
}

export interface Subscription {
  id?: string;
  plan: string;
  status: string;
  maxUsers?: number;
  endDate?: string | null;
  [key: string]: unknown;
}

export interface Role {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  isSystem?: boolean;
  permissions?: Array<{ key: string; description?: string; module?: string }>;
  [key: string]: unknown;
}

export interface Permission {
  key: string;
  module: string;
  action: string;
  description?: string;
  [key: string]: unknown;
}

export interface SystemUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  globalRole: GlobalRole;
  status: string;
  roles?: Array<{ key: string; name: string }>;
  lastLoginAt?: string | null;
  [key: string]: unknown;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  link?: string | null;
  readAt?: string | null;
  createdAt?: string;
  [key: string]: unknown;
}

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  createdAt: string;
  ip?: string | null;
  actor?: { firstName?: string; lastName?: string; email?: string } | null;
  before?: unknown;
  after?: unknown;
  [key: string]: unknown;
}

export interface DashboardData {
  [key: string]: unknown;
}

export interface AnalyticsResult {
  [key: string]: unknown;
}

export interface RequestOptions {
  params?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  formData?: FormData;
  skipAuth?: boolean;
  skipRefresh?: boolean;
  signal?: AbortSignal;
}

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(REFRESH_KEY);
}

export function setTokens(accessToken: string, refreshToken?: string | null): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ACCESS_KEY, accessToken);
  if (refreshToken) window.localStorage.setItem(REFRESH_KEY, refreshToken);
  window.dispatchEvent(new Event(TOKENS_EVENT));
}

export function clearTokens(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
  window.dispatchEvent(new Event(LOGOUT_EVENT));
}

function buildUrl(path: string, params?: RequestOptions['params']): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  const url = `${API_BASE}${clean}`;
  if (!params) return url;
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.append(key, String(value));
  });
  const qs = query.toString();
  return qs ? `${url}?${qs}` : url;
}

function extractMessage(payload: unknown, status: number, fallback: string): string {
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    const message = obj.message ?? obj.error ?? obj.detail;
    if (Array.isArray(message)) return message.join(' · ');
    if (typeof message === 'string' && message.trim()) return message;
    const nested = obj.error;
    if (nested && typeof nested === 'object') {
      const inner = (nested as Record<string, unknown>).message;
      if (typeof inner === 'string') return inner;
    }
  }
  if (typeof payload === 'string' && payload.trim()) return payload;
  return fallback || `Error ${status}`;
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function rawRequest(method: string, path: string, options: RequestOptions = {}): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = options.skipAuth ? null : getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (options.formData) {
    body = options.formData;
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }
  return fetch(buildUrl(path, options.params), {
    method,
    headers,
    body,
    credentials: 'same-origin',
    signal: options.signal,
  });
}

let refreshInFlight: Promise<RefreshResponse> | null = null;

async function performRefresh(): Promise<RefreshResponse> {
  if (!refreshInFlight) {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return Promise.reject(new ApiError('Sesión expirada', 401));
    refreshInFlight = (async () => {
      const response = await fetch(buildUrl('/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ refreshToken }),
        credentials: 'same-origin',
      });
      const payload = await readBody(response);
      if (!response.ok) throw new ApiError(extractMessage(payload, response.status, 'No se pudo renovar la sesión'), response.status, payload);
      const data = payload as RefreshResponse;
      setTokens(data.accessToken, data.refreshToken);
      return data;
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  let response = await rawRequest(method, path, options);

  if (response.status === 401 && !options.skipAuth && !options.skipRefresh && !path.startsWith('/auth/')) {
    try {
      await performRefresh();
      response = await rawRequest(method, path, options);
    } catch {
      clearTokens();
      throw new ApiError('Tu sesión ha expirado. Inicia sesión nuevamente.', 401);
    }
  }

  const payload = await readBody(response);
  if (!response.ok) {
    if (response.status === 401 && !options.skipAuth) window.dispatchEvent(new Event(LOGOUT_EVENT));
    throw new ApiError(extractMessage(payload, response.status, 'Error en la solicitud'), response.status, payload);
  }
  return payload as T;
}

export const api = {
  get: <T>(path: string, params?: RequestOptions['params'], signal?: AbortSignal) =>
    request<T>('GET', path, { params, signal }),
  post: <T>(path: string, body?: unknown, params?: RequestOptions['params']) =>
    request<T>('POST', path, { body, params }),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, { body }),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, { body }),
  delete: <T>(path: string) => request<T>('DELETE', path),
  upload: <T>(path: string, formData: FormData) => request<T>('POST', path, { formData }),
  async download(path: string, params?: RequestOptions['params'], filename = 'export.csv', format = 'csv'): Promise<void> {
    let response = await rawRequest('GET', path, { params });
    if (response.status === 401) {
      try {
        await performRefresh();
        response = await rawRequest('GET', path, { params });
      } catch {
        clearTokens();
        throw new ApiError('Tu sesión ha expirado. Inicia sesión nuevamente.', 401);
      }
    }
    if (!response.ok) {
      const payload = await readBody(response);
      throw new ApiError(extractMessage(payload, response.status, 'No se pudo descargar el archivo'), response.status, payload);
    }
    const blob = await response.blob();
    const disposition = response.headers.get('content-disposition');
    const match = disposition?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
    const name = match?.[1] ? decodeURIComponent(match[1]) : filename;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name.endsWith(`.${format}`) ? name : `${name}.${format}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};
