import { asNumber, asString } from './utils';

function norm(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Busca recursivamente un arreglo por posibles nombres de clave en una respuesta de API. */
export function findArray(payload: unknown, keys: string[], depth = 4): unknown[] {
  if (depth < 0 || payload === null || typeof payload !== 'object') return [];
  if (Array.isArray(payload)) return payload;
  const wanted = keys.map(norm);
  const obj = payload as Record<string, unknown>;
  for (const [key, value] of Object.entries(obj)) {
    if (wanted.includes(norm(key)) && Array.isArray(value)) return value;
  }
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object') {
      const found = findArray(value, keys, depth - 1);
      if (found.length) return found;
    }
  }
  return [];
}

/** Busca recursivamente un valor numérico por posibles nombres de clave. */
export function findNumber(payload: unknown, keys: string[], depth = 4): number | null {
  if (depth < 0 || payload === null || typeof payload !== 'object') return null;
  const wanted = keys.map(norm);
  const obj = payload as Record<string, unknown>;
  for (const [key, value] of Object.entries(obj)) {
    if (wanted.includes(norm(key)) && typeof value !== 'object' && value !== null && value !== '') {
      const n = Number(value);
      if (Number.isFinite(n)) return n;
    }
  }
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object') {
      const found = findNumber(value, keys, depth - 1);
      if (found !== null) return found;
    }
  }
  return null;
}

export interface ChartPoint {
  label: string;
  value: number;
  extra: Record<string, unknown>;
}

/** Convierte filas heterogéneas de la API en puntos para recharts. */
export function chartPoints(rows: unknown[], labelKeys: string[], valueKeys: string[]): ChartPoint[] {
  return rows
    .map((row) => {
      if (row === null || typeof row !== 'object') return null;
      const obj = row as Record<string, unknown>;
      const findValue = (candidates: string[]): unknown => {
        const wanted = candidates.map(norm);
        const entry = Object.entries(obj).find(([key]) => wanted.includes(norm(key)));
        return entry?.[1];
      };
      const rawLabel = findValue(labelKeys);
      const rawValue = findValue(valueKeys);
      const value = Number(rawValue);
      if (!Number.isFinite(value)) return null;
      const label = asString(rawLabel, '—');
      return { label: label.length > 16 ? label.slice(0, 16) : label, value, extra: obj };
    })
    .filter((point): point is ChartPoint => point !== null);
}

export function firstNumber(row: unknown, keys: string[]): number {
  if (!row || typeof row !== 'object') return 0;
  const obj = row as Record<string, unknown>;
  const wanted = keys.map(norm);
  const entry = Object.entries(obj).find(([key]) => wanted.includes(norm(key)));
  return entry ? asNumber(entry[1]) : 0;
}
