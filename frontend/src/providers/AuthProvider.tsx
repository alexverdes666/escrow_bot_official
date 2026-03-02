'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/lib/auth';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const loadFromStorage = useAuthStore((s) => s.loadFromStorage);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  return <>{children}</>;
}
