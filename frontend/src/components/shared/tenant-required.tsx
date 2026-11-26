'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth';

/** Puerta de entrada a módulos operativos cuando no hay empresa activa. */
export function TenantRequired() {
  const { tenants, switchTenant, isSuperAdmin } = useAuth();
  const { success, error: toastError } = useToast();
  const [slug, setSlug] = useState('');
  const [busy, setBusy] = useState(false);

  async function enterTenant() {
    if (!slug || busy) return;
    setBusy(true);
    try {
      await switchTenant(slug);
      success('Empresa activada');
    } catch (err) {
      toastError('No se pudo activar la empresa', err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mx-auto max-w-2xl border-amber-200">
      <CardHeader>
        <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
          <Building2 className="h-5 w-5" />
        </div>
        <CardTitle>Selecciona una empresa</CardTitle>
        <CardDescription>
          Los módulos operativos trabajan dentro de una empresa. Elige una para continuar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {tenants.length > 0 ? (
          <div className="flex flex-col gap-3 sm:flex-row">
            <Select
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              placeholder="Selecciona una empresa"
              options={tenants.map((tenant) => ({ value: tenant.slug, label: tenant.name }))}
              aria-label="Empresa"
            />
            <Button onClick={() => void enterTenant()} disabled={!slug || busy} className="shrink-0">
              {busy ? 'Activando…' : 'Entrar'}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
            No hay empresas disponibles para tu usuario.
          </p>
        )}
        {isSuperAdmin && (
          <Link
            href="/admin/tenants"
            className="inline-flex items-center gap-1 text-sm font-medium text-amber-700 hover:text-amber-800"
          >
            Abrir panel multiempresa <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
