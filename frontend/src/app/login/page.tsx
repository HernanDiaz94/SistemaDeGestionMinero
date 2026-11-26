'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowRight, Building2, Eye, EyeOff, Loader2, LockKeyhole, Mail, Pickaxe, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';
import type { TenantSummary } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const { login, switchTenant, user, loading, error: authError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingTenants, setPendingTenants] = useState<TenantSummary[]>([]);
  const [nextPath, setNextPath] = useState('/dashboard');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const next = params.get('next');
    setNextPath(next && next.startsWith('/') ? next : '/dashboard');
  }, []);

  useEffect(() => {
    if (!loading && user && (user.tenantId || pendingTenants.length === 0)) router.replace(nextPath);
  }, [loading, user, nextPath, pendingTenants, router]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Ingrese su correo electrónico y contraseña.');
      return;
    }
    setSubmitting(true);
    try {
      const response = await login(email.trim(), password, tenantSlug.trim() || undefined);
      const needsSelection = (response.user.globalRole === 'SUPERADMIN' || !response.user.tenantId) && response.tenants.length > 1 && !tenantSlug;
      if (needsSelection) setPendingTenants(response.tenants);
      else router.replace(nextPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión');
    } finally {
      setSubmitting(false);
    }
  }

  async function chooseTenant(slug: string) {
    setSubmitting(true);
    setError(null);
    try {
      await switchTenant(slug);
      setPendingTenants([]);
      router.replace(nextPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo seleccionar la empresa');
    } finally {
      setSubmitting(false);
    }
  }

  function useDemo(demoEmail: string) {
    setEmail(demoEmail);
    setPassword('Demo1234!');
    setError(null);
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <div className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-emerald-950 p-12 text-white lg:flex">
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500 text-emerald-950">
            <Pickaxe className="h-6 w-6" />
          </div>
          <div>
            <p className="font-bold tracking-[0.12em]">MINING MANAGER</p>
            <p className="text-xs uppercase tracking-[0.25em] text-amber-400">Inteligencia operativa minera</p>
          </div>
        </div>
        <div className="relative max-w-xl space-y-6">
          <h1 className="text-4xl font-bold leading-tight">
            Control total de su operación, <span className="text-amber-400">desde el frente hasta la oficina.</span>
          </h1>
          <p className="text-base leading-relaxed text-emerald-100/80">
            Planifique proyectos, registre partes diarios, supervise producción y maquinaria, y tome decisiones con datos
            concretos en una sola plataforma.
          </p>
          <div className="grid grid-cols-2 gap-3 pt-4">
            {['Proyectos y yacimientos', 'Partes y aprobaciones', 'Producción en tiempo real', 'Reportes ejecutivos'].map((item) => (
              <div key={item} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm">
                <ShieldCheck className="h-4 w-4 shrink-0 text-amber-400" />
                {item}
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-emerald-100/50">© {new Date().getFullYear()} Mining Manager · Uso exclusivo de personal autorizado</p>
      </div>

      <div className="flex flex-1 items-center justify-center bg-slate-50 p-5 md:p-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-900 text-amber-400">
              <Pickaxe className="h-5 w-5" />
            </div>
            <p className="font-bold tracking-wide text-emerald-900">MINING MANAGER</p>
          </div>

          {pendingTenants.length > 0 ? (
            <Card>
              <CardContent className="space-y-5 p-7">
                <div>
                  <Badge variant="warning">Paso 2 de 2</Badge>
                  <h2 className="mt-3 text-2xl font-bold text-slate-900">Seleccione una empresa</h2>
                  <p className="mt-1 text-sm text-slate-500">Su usuario tiene acceso a múltiples organizaciones.</p>
                </div>
                <div className="space-y-2">
                  {pendingTenants.map((tenant) => (
                    <button
                      key={tenant.id}
                      type="button"
                      disabled={submitting}
                      onClick={() => void chooseTenant(tenant.slug)}
                      className="flex w-full items-center gap-3 rounded-lg border border-slate-200 p-3 text-left transition-colors hover:border-amber-400 hover:bg-amber-50 disabled:opacity-50"
                    >
                      <Building2 className="h-5 w-5 text-amber-600" />
                      <span className="flex-1 text-sm font-semibold text-slate-800">{tenant.name}</span>
                      <ArrowRight className="h-4 w-4 text-slate-400" />
                    </button>
                  ))}
                </div>
                {(error || authError) && <p className="text-sm text-red-600">{error || authError}</p>}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-slate-200 shadow-lg">
              <CardContent className="space-y-6 p-7">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900">Iniciar sesión</h2>
                  <p className="mt-1 text-sm text-slate-500">Ingrese sus credenciales para acceder al sistema.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Correo electrónico</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        id="email"
                        type="email"
                        autoComplete="username"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="nombre@empresa.com"
                        className="pl-9"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Contraseña</Label>
                    <div className="relative">
                      <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="••••••••"
                        className="pl-9 pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((value) => !value)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                        aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tenantSlug">Empresa (slug, opcional)</Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        id="tenantSlug"
                        value={tenantSlug}
                        onChange={(event) => setTenantSlug(event.target.value)}
                        placeholder="minera-aurora"
                        className="pl-9"
                      />
                    </div>
                    <p className="text-xs text-slate-400">Déjelo vacío para usar la empresa predeterminada.</p>
                  </div>

                  {(error || authError) && (
                    <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{error || authError}</span>
                    </div>
                  )}

                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    Ingresar al sistema
                  </Button>
                </form>

                <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/60 p-4">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-amber-800">Credenciales de demostración</p>
                  <div className="space-y-2 text-xs text-slate-600">
                    <button type="button" onClick={() => useDemo('superadmin@miningmanager.com.ar')} className="block w-full rounded px-2 py-1 text-left hover:bg-amber-100">
                      <span className="font-semibold text-slate-800">Superadministrador:</span> superadmin@miningmanager.com.ar / Demo1234!
                    </button>
                    <button type="button" onClick={() => useDemo('admin@mineraaurora.com.ar')} className="block w-full rounded px-2 py-1 text-left hover:bg-amber-100">
                      <span className="font-semibold text-slate-800">Administrador:</span> admin@mineraaurora.com.ar / Demo1234!
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
