'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

interface PaginationProps {
  page: number;
  totalPages: number;
  totalItems?: number;
  pageSize?: number;
  onChange: (page: number) => void;
  className?: string;
}

export function Pagination({ page, totalPages, totalItems, pageSize, onChange, className }: PaginationProps) {
  if (totalPages <= 1 && !totalItems) return null;
  const pages: number[] = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, start + 4);
  for (let i = start; i <= end; i += 1) pages.push(i);

  return (
    <div className={cn('flex flex-col gap-3 border-t border-slate-100 px-5 py-3 sm:flex-row sm:items-center sm:justify-between', className)}>
      <p className="text-xs text-slate-500">
        {totalItems !== undefined
          ? `Mostrando ${totalItems === 0 ? 0 : (page - 1) * (pageSize ?? 10) + 1}–${Math.min(page * (pageSize ?? 10), totalItems)} de ${totalItems} registros`
          : `Página ${page} de ${Math.max(totalPages, 1)}`}
      </p>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Página anterior">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {pages.map((n) => (
          <Button
            key={n}
            variant={n === page ? 'default' : 'ghost'}
            size="icon"
            className="h-8 w-8 text-xs"
            onClick={() => onChange(n)}
            aria-label={`Página ${n}`}
          >
            {n}
          </Button>
        ))}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          aria-label="Página siguiente"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
