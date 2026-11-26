import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Normaliza respuestas de listado de la API (array, {data}, {items}, {results}). */
export function listOf<T>(response: unknown): T[] {
  if (Array.isArray(response)) return response as T[];
  if (response && typeof response === 'object') {
    const obj = response as Record<string, unknown>;
    for (const key of ['data', 'items', 'results', 'rows']) {
      if (Array.isArray(obj[key])) return obj[key] as T[];
    }
    if (obj.data && typeof obj.data === 'object') return listOf<T>(obj.data);
  }
  return [];
}

/** Extrae el total de una respuesta paginada, si existe. */
export function totalOf(response: unknown): number | undefined {
  if (Array.isArray(response)) return response.length;
  if (response && typeof response === 'object') {
    const obj = response as Record<string, unknown>;
    for (const key of ['total', 'count']) {
      if (typeof obj[key] === 'number') return obj[key];
    }
    for (const key of ['meta', 'pagination']) {
      const nested = obj[key];
      if (nested && typeof nested === 'object') {
        const total = (nested as Record<string, unknown>).total;
        if (typeof total === 'number') return total;
      }
    }
  }
  return undefined;
}

export function asString(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

export function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function todayInput(): string {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10);
}

export function toInputDate(value: unknown): string {
  if (!value) return '';
  const s = String(value);
  return s.slice(0, 10);
}

export function toInputDateTime(value: unknown): string {
  if (!value) return '';
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 16);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
}
