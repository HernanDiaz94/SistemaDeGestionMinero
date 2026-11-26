'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, Inbox, RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination } from '@/components/ui/pagination';
import { Badge } from '@/components/ui/badge';
import { label, statusTone } from '@/lib/format';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn, asString } from '@/lib/utils';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}

export interface TableFilter {
  key: string;
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}

interface ResourceTableProps<T> {
  data: T[];
  columns: Array<Column<T>>;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  filters?: TableFilter[];
  actions?: ReactNode;
  toolbar?: ReactNode;
  page?: number;
  onPageChange?: (page: number) => void;
  pageSize?: number;
  getRowKey: (row: T) => string;
  emptyTitle?: string;
  emptyDescription?: string;
  totalItems?: number;
  onRowClick?: (row: T) => void;
}

export function ResourceTable<T>({
  data,
  columns,
  loading = false,
  error = null,
  onRetry,
  search,
  onSearchChange,
  searchPlaceholder = 'Buscar…',
  filters = [],
  actions,
  toolbar,
  page: controlledPage,
  onPageChange,
  pageSize = 10,
  getRowKey,
  emptyTitle = 'No hay registros',
  emptyDescription = 'Aún no se han creado elementos en esta sección.',
  totalItems,
  onRowClick,
}: ResourceTableProps<T>) {
  const [internalPage, setInternalPage] = useState(1);
  const page = controlledPage ?? internalPage;
  const setPage = onPageChange ?? setInternalPage;
  const count = totalItems ?? data.length;
  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages, setPage]);

  const visible = useMemo(() => {
    if (controlledPage !== undefined || totalItems !== undefined) return data;
    return data.slice((internalPage - 1) * pageSize, internalPage * pageSize);
  }, [controlledPage, totalItems, data, internalPage, pageSize]);

  const showToolbar = !!onSearchChange || filters.length > 0 || !!actions || !!toolbar;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {showToolbar && (
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap">
            {onSearchChange && (
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search ?? ''}
                  onChange={(event) => onSearchChange(event.target.value)}
                  placeholder={searchPlaceholder}
                  className="pl-9"
                />
              </div>
            )}
            {filters.map((filter) => (
              <Select
                key={filter.key}
                aria-label={filter.label}
                value={filter.value}
                onChange={(event) => filter.onChange(event.target.value)}
                options={filter.options}
                placeholder={filter.label}
                className="w-full sm:w-44"
              />
            ))}
            {toolbar}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}

      {error ? (
        <div className="m-4 flex flex-col items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-8 text-center">
          <AlertTriangle className="h-8 w-8 text-red-500" />
          <div>
            <p className="font-semibold text-red-800">No se pudieron cargar los datos</p>
            <p className="mt-1 text-sm text-red-600">{error}</p>
          </div>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RefreshCw className="h-4 w-4" /> Reintentar
            </Button>
          )}
        </div>
      ) : loading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex gap-4">
              {columns.map((column) => (
                <Skeleton key={column.key} className="h-8 flex-1" />
              ))}
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 p-12 text-center">
          <div className="rounded-full bg-slate-100 p-3">
            <Inbox className="h-7 w-7 text-slate-400" />
          </div>
          <div>
            <p className="font-semibold text-slate-700">{emptyTitle}</p>
            <p className="mt-1 text-sm text-slate-500">{emptyDescription}</p>
          </div>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.key} className={column.className}>
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((row, index) => (
              <TableRow
                key={getRowKey(row) || String(index)}
                className={cn(onRowClick && 'cursor-pointer')}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((column) => (
                  <TableCell key={column.key} className={column.className}>
                    {column.render(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {!error && !loading && visible.length > 0 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          totalItems={totalItems !== undefined || controlledPage !== undefined ? count : undefined}
          pageSize={pageSize}
          onChange={setPage}
        />
      )}
    </div>
  );
}

export function StatusCell({ value }: { value: unknown }) {
  return <Badge variant={statusTone(value)}>{label(value)}</Badge>;
}

export function TextCell({ value, fallback = '—' }: { value: unknown; fallback?: string }) {
  return <span className="text-sm">{asString(value, fallback)}</span>;
}
