'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, type RequestOptions } from '@/lib/api';
import { listOf, totalOf } from '@/lib/utils';

interface ResourceState<T> {
  data: T[];
  total?: number;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/** Carga un listado de la API y expone estado de carga/error/recarga. */
export function useApiList<T>(path: string | null, params?: RequestOptions['params'], deps: unknown[] = []): ResourceState<T> {
  const [data, setData] = useState<T[]>([]);
  const [total, setTotal] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const serializedParams = JSON.stringify(params ?? {});

  const reload = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    if (!path) {
      setData([]);
      setLoading(false);
      setError(null);
      return;
    }
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(null);
    api
      .get<unknown>(path, params, controller.signal)
      .then((response) => {
        if (!active) return;
        setData(listOf<T>(response));
        setTotal(totalOf(response));
      })
      .catch((err: unknown) => {
        if (!active || controller.signal.aborted) return;
        setData([]);
        setError(err instanceof Error ? err.message : 'No se pudieron cargar los datos');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
    // serializedParams cubre cambios de filtros sin recrear la función en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, serializedParams, tick, ...deps]);

  return { data, total, loading, error, reload };
}

/** Carga un recurso individual. */
export function useApiItem<T>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    if (!path) {
      setData(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(null);
    api
      .get<T>(path, undefined, controller.signal)
      .then((response) => {
        if (active) setData(response);
      })
      .catch((err: unknown) => {
        if (!active || controller.signal.aborted) return;
        setData(null);
        setError(err instanceof Error ? err.message : 'No se pudo cargar el recurso');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, tick, ...deps]);

  return { data, loading, error, reload };
}
