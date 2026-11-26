'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  api,
  clearTokens,
  getAccessToken,
  LOGOUT_EVENT,
  setTokens,
  TOKENS_EVENT,
  type AuthUser,
  type LoginResponse,
  type MeResponse,
  type TenantSummary,
} from './api';

interface AuthContextValue {
  user: AuthUser | null;
  tenants: TenantSummary[];
  loading: boolean;
  error: string | null;
  login: (email: string, password: string, tenantSlug?: string) => Promise<LoginResponse>;
  logout: () => Promise<void>;
  switchTenant: (tenantSlug: string) => Promise<void>;
  refreshMe: () => Promise<void>;
  can: (permission: string) => boolean;
  isSuperAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeMe(data: MeResponse): AuthUser {
  const tenant = data.tenant;
  return {
    id: data.id,
    email: data.email,
    firstName: data.firstName,
    lastName: data.lastName,
    globalRole: data.globalRole,
    tenantId: tenant?.id ?? null,
    tenantName: tenant?.name ?? null,
    tenantSlug: tenant?.slug ?? null,
    timezone: data.timezone,
    permissions: data.permissions ?? [],
    roles: data.roles ?? [],
    status: data.status,
  };
}

function isLoginResponse(value: unknown): value is LoginResponse {
  return !!value && typeof value === 'object' && 'accessToken' in value && 'user' in value;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const refreshMe = useCallback(async () => {
    if (!getAccessToken()) {
      setUser(null);
      setTenants([]);
      return;
    }
    try {
      const data = await api.get<MeResponse>('/auth/me');
      setUser(normalizeMe(data));
      setTenants(data.tenants ?? (data.tenant ? [data.tenant] : []));
      setError(null);
    } catch (err) {
      setUser(null);
      setTenants([]);
      setError(err instanceof Error ? err.message : 'No se pudo cargar el perfil');
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      await refreshMe();
      if (active) setLoading(false);
    })();
    const onLogout = () => {
      setUser(null);
      setTenants([]);
    };
    const onTokens = () => {
      void refreshMe();
    };
    window.addEventListener(LOGOUT_EVENT, onLogout);
    window.addEventListener(TOKENS_EVENT, onTokens);
    return () => {
      active = false;
      window.removeEventListener(LOGOUT_EVENT, onLogout);
      window.removeEventListener(TOKENS_EVENT, onTokens);
    };
  }, [refreshMe]);

  const login = useCallback(
    async (email: string, password: string, tenantSlug?: string) => {
      setError(null);
      const payload: Record<string, string> = { email, password };
      if (tenantSlug) payload.tenantSlug = tenantSlug;
      const response = await api.post<LoginResponse>('/auth/login', payload);
      if (!isLoginResponse(response)) throw new Error('Respuesta de autenticación inválida');
      setTokens(response.accessToken, response.refreshToken);
      setUser(response.user);
      setTenants(response.tenants ?? []);
      return response;
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      clearTokens();
    } finally {
      setUser(null);
      setTenants([]);
      router.replace('/login');
    }
  }, [router]);

  const switchTenant = useCallback(
    async (tenantSlug: string) => {
      const response = await api.post<{
        accessToken: string;
        refreshToken: string;
        user?: Partial<AuthUser> & { tenantId?: string | null; permissions?: string[] };
      }>('/auth/switch-tenant', { tenantSlug });
      setTokens(response.accessToken, response.refreshToken);
      const tenant = tenants.find((t) => t.slug === tenantSlug);
      setUser((current) => ({
        ...(current ?? { id: '', email: '', globalRole: 'USER', permissions: [] }),
        ...response.user,
        tenantId: response.user?.tenantId ?? tenant?.id ?? null,
        tenantName: tenant?.name ?? current?.tenantName ?? null,
        tenantSlug,
        permissions: response.user?.permissions ?? current?.permissions ?? [],
      }));
      await refreshMe();
      router.refresh();
    },
    [refreshMe, router, tenants],
  );

  const can = useCallback(
    (permission: string) => {
      if (!user) return false;
      if (user.globalRole === 'SUPERADMIN') return true;
      const permissions = user.permissions ?? [];
      if (permissions.includes(permission)) return true;
      const [module] = permission.split('.');
      return permissions.includes(`${module}.*`) || permissions.includes('*');
    },
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      tenants,
      loading,
      error,
      login,
      logout,
      switchTenant,
      refreshMe,
      can,
      isSuperAdmin: user?.globalRole === 'SUPERADMIN',
    }),
    [user, tenants, loading, error, login, logout, switchTenant, refreshMe, can],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      const next = typeof window !== 'undefined' ? window.location.pathname : '/dashboard';
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-200 border-t-amber-600" />
          <p className="text-sm">Cargando sesión…</p>
        </div>
      </div>
    );
  }
  if (!user) return null;
  return <>{children}</>;
}
