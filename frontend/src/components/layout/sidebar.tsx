'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Building2,
  ChevronLeft,
  ClipboardList,
  Factory,
  FolderKanban,
  LayoutDashboard,
  Mountain,
  Pickaxe,
  Settings,
  Truck,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { initials } from '@/lib/format';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/projects', label: 'Proyectos', icon: FolderKanban },
  { href: '/mines', label: 'Yacimientos', icon: Mountain },
  { href: '/operations', label: 'Operaciones', icon: ClipboardList },
  { href: '/production', label: 'Producción', icon: Factory },
  { href: '/equipment', label: 'Maquinaria', icon: Truck },
  { href: '/personnel', label: 'Personal', icon: Users },
  { href: '/reports', label: 'Reportes', icon: BarChart3 },
  { href: '/settings', label: 'Configuración', icon: Settings },
];

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, isSuperAdmin } = useAuth();

  function item(item: NavItem) {
    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onMobileClose}
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
          active
            ? 'bg-emerald-900 text-white shadow-sm'
            : 'text-slate-400 hover:bg-white/10 hover:text-white',
        )}
      >
        <Icon className={cn('h-[18px] w-[18px] shrink-0', active ? 'text-amber-400' : '')} />
        {item.label}
      </Link>
    );
  }

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={onMobileClose}
          className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden"
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-slate-900 transition-transform duration-200 lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-white/10 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500 text-slate-950">
            <Pickaxe className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold tracking-wide text-white">MINING MANAGER</p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-amber-400/80">Gestión minera</p>
          </div>
          <button
            type="button"
            onClick={onMobileClose}
            className="rounded p-1 text-slate-400 hover:bg-white/10 lg:hidden"
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Módulos</p>
          {NAV.map(item)}
          {isSuperAdmin && (
            <div className="pt-5">
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Administración</p>
              {item({ href: '/admin/tenants', label: 'Panel multiempresa', icon: Building2 })}
            </div>
          )}
        </nav>

        <div className="shrink-0 border-t border-white/10 p-4">
          <div className="flex items-center gap-3 rounded-lg bg-white/5 p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-slate-950">
              {initials(user?.firstName, user?.lastName)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="truncate text-[11px] text-slate-400">{user?.email}</p>
            </div>
            <ChevronLeft className="h-4 w-4 text-slate-500" />
          </div>
        </div>
      </aside>
    </>
  );
}
