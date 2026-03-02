'use client';

import { useAuthStore } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function AuthGuard({ children, requireAdmin = false }: { children: React.ReactNode; requireAdmin?: boolean }) {
  const { user, isLoading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
    if (!isLoading && requireAdmin && user?.role !== 'admin') {
      router.push('/deals');
    }
  }, [user, isLoading, router, requireAdmin]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!user) return null;
  if (requireAdmin && user.role !== 'admin') return null;

  return <>{children}</>;
}
