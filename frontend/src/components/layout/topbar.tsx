'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Building2,
  Check,
  ChevronDown,
  ClipboardList,
  FolderKanban,
  LogOut,
  Menu,
  Mountain,
  Search,
  Settings,
  Truck,
  UserCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth';
import { api, type Employee, type Equipment, type Mine, type Project, type OperationReport } from '@/lib/api';
import { useApiList } from '@/hooks/use-api';
import { listOf, asString } from '@/lib/utils';
import { formatDateTime, initials, label } from '@/lib/format';

interface TopbarProps {
  onMenuClick: () => void;
}

interface SearchResult {
  title: string;
  subtitle: string;
  href: string;
  group: string;
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const { user, tenants, switchTenant, logout } = useAuth();
  const { toast, success, error: toastError } = useToast();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const notifications = useApiList<{
    id: string;
    title: string;
    body: string;
    link?: string | null;
    readAt?: string | null;
    createdAt?: string;
  }>(user?.tenantId ? '/notifications' : null);

  const unread = notifications.data.filter((item) => !item.readAt).length;

  useEffect(() => {
    if (!user?.tenantId || !query.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      const term = query.trim();
      const endpoints: Array<[string, string, (row: never) => SearchResult]> = [
        ['/projects', 'Proyectos', (row: never) => {
          const item = row as Project;
          return { title: item.name, subtitle: item.code, href: '/projects', group: 'Proyectos' };
        }],
        ['/mines', 'Yacimientos', (row: never) => {
          const item = row as Mine;
          return { title: item.name, subtitle: item.code, href: `/mines?sector=${item.id}`, group: 'Yacimientos' };
        }],
        ['/equipment', 'Maquinaria', (row: never) => {
          const item = row as Equipment;
          return { title: item.name, subtitle: item.code, href: '/equipment', group: 'Maquinaria' };
        }],
        ['/employees', 'Personal', (row: never) => {
          const item = row as Employee;
          return { title: `${item.firstName} ${item.lastName}`, subtitle: item.code, href: '/personnel', group: 'Personal' };
        }],
        ['/reports', 'Partes', (row: never) => {
          const item = row as OperationReport;
          return { title: item.code, subtitle: label(item.status), href: '/operations', group: 'Operaciones' };
        }],
      ];
      const found = await Promise.all(
        endpoints.map(async ([path, , map]) => {
          try {
            const response = await api.get<unknown>(path, { search: term, q: term, limit: 5 }, controller.signal);
            return listOf<never>(response).slice(0, 4).map(map);
          } catch {
            return [] as SearchResult[];
          }
        }),
      );
      if (!controller.signal.aborted) setResults(found.flat().slice(0, 10));
      if (!controller.signal.aborted) setSearching(false);
    }, 300);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, user?.tenantId]);

  async function markRead(id: string) {
    try {
      await api.post(`/notifications/${id}/read`);
      notifications.reload();
    } catch (err) {
      toastError('No se pudo marcar la notificación', err instanceof Error ? err.message : undefined);
    }
  }

  function handleSearchSubmit(event: FormEvent) {
    event.preventDefault();
    setSearchOpen(true);
    if (results.length === 1) router.push(results[0].href);
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur md:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick} aria-label="Abrir menú">
        <Menu className="h-5 w-5" />
      </Button>

      <div className="relative w-full max-w-md">
        <form onSubmit={handleSearchSubmit}>
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            placeholder="Buscar proyectos, minas, maquinaria…"
            className="h-9 bg-slate-50 pl-9"
            aria-label="Buscador global"
          />
        </form>
        {searchOpen && query.trim() && (
          <div className="absolute left-0 top-11 z-50 w-full max-w-lg overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
            <div className="max-h-80 overflow-y-auto p-1">
              {searching && <p className="p-4 text-center text-sm text-slate-500">Buscando…</p>}
              {!searching && results.length === 0 && (
                <p className="p-4 text-center text-sm text-slate-500">Sin resultados para “{query}”</p>
              )}
              {results.map((result, index) => {
                const Icon = result.group === 'Proyectos' ? FolderKanban : result.group === 'Yacimientos' ? Mountain : result.group === 'Maquinaria' ? Truck : result.group === 'Personal' ? UserCircle : ClipboardList;
                return (
                  <Link
                    key={`${result.group}-${index}`}
                    href={result.href}
                    onClick={() => {
                      setSearchOpen(false);
                      setQuery('');
                    }}
                    className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-slate-50"
                  >
                    <Icon className="h-4 w-4 text-amber-600" />
                    <span className="min-w-0 flex-1 truncate font-medium text-slate-700">{result.title}</span>
                    <span className="text-xs text-slate-400">{result.group}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="ml-auto flex items-center gap-1 md:gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="hidden gap-2 md:inline-flex">
              <Building2 className="h-4 w-4 text-amber-600" />
              <span className="max-w-32 truncate">{user?.tenantName ?? 'Selecciona empresa'}</span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Empresa activa</DropdownMenuLabel>
            {tenants.length === 0 && <DropdownMenuItem disabled>Sin empresas asignadas</DropdownMenuItem>}
            {tenants.map((tenant) => (
              <DropdownMenuItem
                key={tenant.id}
                onSelect={async () => {
                  if (tenant.id === user?.tenantId) return;
                  try {
                    await switchTenant(tenant.slug);
                    success('Empresa cambiada', tenant.name);
                  } catch (err) {
                    toastError('No se pudo cambiar de empresa', err instanceof Error ? err.message : undefined);
                  }
                }}
              >
                <Check className={`h-4 w-4 ${tenant.id === user?.tenantId ? 'text-amber-600' : 'invisible'}`} />
                {tenant.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative" aria-label="Notificaciones">
              <Bell className="h-5 w-5 text-slate-500" />
              {unread > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-slate-950">
                  {unread}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Notificaciones ({unread} sin leer)</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notifications.loading && <div className="p-4 text-sm text-slate-500">Cargando…</div>}
            {!notifications.loading && notifications.error && (
              <div className="p-4 text-sm text-red-600">{notifications.error}</div>
            )}
            {!notifications.loading && !notifications.error && notifications.data.length === 0 && (
              <div className="p-4 text-sm text-slate-500">No hay notificaciones</div>
            )}
            <div className="max-h-80 overflow-y-auto">
              {notifications.data.map((notification) => (
                <DropdownMenuItem
                  key={notification.id}
                  className="flex-col items-start gap-1 whitespace-normal"
                  onSelect={() => {
                    if (!notification.readAt) void markRead(notification.id);
                    if (notification.link) router.push(notification.link);
                  }}
                >
                  <div className="flex w-full items-center gap-2">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${notification.readAt ? 'bg-slate-300' : 'bg-amber-500'}`} />
                    <span className="text-sm font-semibold">{notification.title}</span>
                  </div>
                  <p className="pl-4 text-xs text-slate-500">{notification.body}</p>
                  <p className="pl-4 text-[10px] text-slate-400">{formatDateTime(notification.createdAt)}</p>
                </DropdownMenuItem>
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="flex items-center gap-2 rounded-full p-0.5 hover:bg-slate-100" aria-label="Menú de usuario">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-900 text-xs font-bold text-white">
                {initials(user?.firstName, user?.lastName)}
              </span>
              <ChevronDown className="hidden h-3.5 w-3.5 text-slate-400 sm:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>
              <p className="text-sm font-semibold text-slate-800">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs font-normal normal-case text-slate-500">{asString(user?.email)}</p>
              <p className="mt-1 text-[10px] font-normal normal-case tracking-wide text-amber-700">
                {label(user?.globalRole)}
              </p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Settings className="h-4 w-4" /> Configuración
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem destructive onSelect={() => void logout()}>
              <LogOut className="h-4 w-4" /> Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
