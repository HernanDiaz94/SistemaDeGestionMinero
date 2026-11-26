'use client';

import { useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { ProtectedRoute, useAuth } from '@/lib/auth';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { TenantRequired } from '@/components/shared/tenant-required';

const OPERATIONAL_PATHS = [
  '/dashboard',
  '/projects',
  '/mines',
  '/operations',
  '/production',
  '/equipment',
  '/personnel',
  '/reports',
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const { user } = useAuth();
  const needsTenant =
    !user?.tenantId &&
    OPERATIONAL_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-slate-50">
        <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
        <div className="lg:pl-64">
          <Topbar onMenuClick={() => setMobileOpen(true)} />
          <main className="mx-auto w-full max-w-[1600px] p-4 md:p-6 lg:p-8">
            {needsTenant ? <TenantRequired /> : children}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
