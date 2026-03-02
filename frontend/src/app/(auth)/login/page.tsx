'use client';

import { TelegramLoginButton } from '@/components/auth/TelegramLoginButton';
import { useAuthStore } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Shield } from 'lucide-react';

export default function LoginPage() {
  const { user, isLoading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      router.push('/deals');
    }
  }, [user, isLoading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-600 to-primary-800">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4 text-center">
        <Shield className="w-12 h-12 mx-auto mb-4 text-primary-600" />
        <h1 className="text-2xl font-bold mb-2">Login to Escrow Dashboard</h1>
        <p className="text-gray-500 mb-8">
          Sign in with your Telegram account to view and manage your deals.
        </p>
        <TelegramLoginButton />
        <p className="text-xs text-gray-400 mt-6">
          By logging in, you agree to our terms of service.
        </p>
      </div>
    </div>
  );
}
