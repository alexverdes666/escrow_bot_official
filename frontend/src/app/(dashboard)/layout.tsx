'use client';

import { Navbar } from '@/components/layout/Navbar';
import { AuthGuard } from '@/components/auth/AuthGuard';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </AuthGuard>
  );
}
